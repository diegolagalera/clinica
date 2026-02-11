import type { Database } from '../db/index.js';
import {
    chatKnowledgeBases,
    chatKnowledgeArticles,
    chatKnowledgeChunks,
} from '../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { logger } from '../utils/logger.js';
import { config } from '../config/env.js';

const CHUNK_SIZE = 500;     // ~500 tokens per chunk
const CHUNK_OVERLAP = 50;   // Overlap between chunks

/**
 * Knowledge Base Service
 * Manages knowledge collections, articles, text chunking, and embeddings for RAG.
 */
export class ChatbotKnowledgeService {

    // ========================================================================
    // Knowledge Bases (Collections)
    // ========================================================================

    static async getKnowledgeBases(db: Database, clinicId: string) {
        const bases = await db
            .select()
            .from(chatKnowledgeBases)
            .where(and(
                eq(chatKnowledgeBases.clinicId, clinicId),
                eq(chatKnowledgeBases.isActive, true)
            ))
            .orderBy(chatKnowledgeBases.createdAt);

        // Get article counts for each base
        const result = [];
        for (const base of bases) {
            const articles = await db
                .select()
                .from(chatKnowledgeArticles)
                .where(eq(chatKnowledgeArticles.knowledgeBaseId, base.id));
            result.push({
                ...base,
                articleCount: articles.length,
            });
        }
        return result;
    }

    static async createKnowledgeBase(db: Database, clinicId: string, data: {
        name: string;
        description?: string;
        icon?: string;
    }, userId: string) {
        const [kb] = await db
            .insert(chatKnowledgeBases)
            .values({
                clinicId,
                name: data.name,
                description: data.description || null,
                icon: data.icon || '📚',
                createdById: userId,
            })
            .returning();

        logger.info({ clinicId, knowledgeBaseId: kb!.id, name: kb!.name }, 'Knowledge base created');
        return kb!;
    }

    static async updateKnowledgeBase(db: Database, id: string, clinicId: string, data: {
        name?: string;
        description?: string;
        icon?: string;
    }) {
        const [kb] = await db
            .update(chatKnowledgeBases)
            .set({
                ...(data.name && { name: data.name }),
                ...(data.description !== undefined && { description: data.description }),
                ...(data.icon && { icon: data.icon }),
                updatedAt: new Date(),
            })
            .where(and(
                eq(chatKnowledgeBases.id, id),
                eq(chatKnowledgeBases.clinicId, clinicId)
            ))
            .returning();
        return kb || null;
    }

    static async deleteKnowledgeBase(db: Database, id: string, clinicId: string) {
        // Cascades to articles → chunks
        const [deleted] = await db
            .delete(chatKnowledgeBases)
            .where(and(
                eq(chatKnowledgeBases.id, id),
                eq(chatKnowledgeBases.clinicId, clinicId)
            ))
            .returning();
        return !!deleted;
    }

    // ========================================================================
    // Articles
    // ========================================================================

    static async getArticles(db: Database, knowledgeBaseId: string, clinicId: string) {
        return db
            .select()
            .from(chatKnowledgeArticles)
            .where(and(
                eq(chatKnowledgeArticles.knowledgeBaseId, knowledgeBaseId),
                eq(chatKnowledgeArticles.clinicId, clinicId)
            ))
            .orderBy(chatKnowledgeArticles.createdAt);
    }

    static async createArticle(db: Database, data: {
        knowledgeBaseId: string;
        clinicId: string;
        title: string;
        content: string;
        sourceType: string;
        sourceFilename?: string;
        userId: string;
    }) {
        const [article] = await db
            .insert(chatKnowledgeArticles)
            .values({
                knowledgeBaseId: data.knowledgeBaseId,
                clinicId: data.clinicId,
                title: data.title,
                originalContent: data.content,
                sourceType: data.sourceType,
                sourceFilename: data.sourceFilename || null,
                createdById: data.userId,
            })
            .returning();

        // Process chunks and embeddings asynchronously
        this.processArticleEmbeddings(db, article!.id, data.clinicId, data.content).catch(err => {
            logger.error({ articleId: article!.id, error: err }, 'Background embedding processing failed');
        });

        logger.info({ articleId: article!.id, title: data.title }, 'Knowledge article created');
        return article;
    }

    static async deleteArticle(db: Database, articleId: string, clinicId: string) {
        // Cascades to chunks
        const [deleted] = await db
            .delete(chatKnowledgeArticles)
            .where(and(
                eq(chatKnowledgeArticles.id, articleId),
                eq(chatKnowledgeArticles.clinicId, clinicId)
            ))
            .returning();
        return !!deleted;
    }

    static async updateArticle(db: Database, articleId: string, clinicId: string, data: {
        title?: string;
        content?: string;
    }) {
        const updateData: any = { updatedAt: new Date() };
        if (data.title) updateData.title = data.title;
        if (data.content) updateData.originalContent = data.content;

        const [article] = await db
            .update(chatKnowledgeArticles)
            .set(updateData)
            .where(and(
                eq(chatKnowledgeArticles.id, articleId),
                eq(chatKnowledgeArticles.clinicId, clinicId)
            ))
            .returning();

        if (!article) return null;

        // Re-process embeddings if content changed
        if (data.content) {
            this.processArticleEmbeddings(db, article.id, clinicId, data.content).catch(err => {
                logger.error({ articleId: article.id, error: err }, 'Background embedding re-processing failed');
            });
        }

        logger.info({ articleId: article.id, title: article.title }, 'Knowledge article updated');
        return article;
    }

    // ========================================================================
    // Text Chunking
    // ========================================================================

    /**
     * Split text into overlapping chunks of approximately CHUNK_SIZE tokens.
     * Uses sentence-aware splitting to avoid breaking mid-sentence.
     */
    static chunkText(text: string): string[] {
        // Split into sentences
        const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim());
        const chunks: string[] = [];
        let currentChunk = '';
        let currentTokens = 0;

        for (const sentence of sentences) {
            const sentenceTokens = this.estimateTokens(sentence);

            if (currentTokens + sentenceTokens > CHUNK_SIZE && currentChunk) {
                chunks.push(currentChunk.trim());

                // Keep overlap: take last ~CHUNK_OVERLAP tokens worth of text
                const overlapSentences = currentChunk.split(/(?<=[.!?])\s+/);
                let overlapText = '';
                let overlapTokens = 0;
                for (let i = overlapSentences.length - 1; i >= 0; i--) {
                    const st = this.estimateTokens(overlapSentences[i]!);
                    if (overlapTokens + st > CHUNK_OVERLAP) break;
                    overlapText = overlapSentences[i]! + ' ' + overlapText;
                    overlapTokens += st;
                }
                currentChunk = overlapText + sentence;
                currentTokens = overlapTokens + sentenceTokens;
            } else {
                currentChunk += (currentChunk ? ' ' : '') + sentence;
                currentTokens += sentenceTokens;
            }
        }

        if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
        }

        return chunks;
    }

    /**
     * Rough token estimation (~4 chars per token for English/Spanish).
     */
    static estimateTokens(text: string): number {
        return Math.ceil(text.length / 4);
    }

    // ========================================================================
    // Embeddings
    // ========================================================================

    /**
     * Process an article: chunk text and generate embeddings.
     */
    static async processArticleEmbeddings(db: Database, articleId: string, clinicId: string, content: string) {
        try {
            // Delete existing chunks
            await db
                .delete(chatKnowledgeChunks)
                .where(eq(chatKnowledgeChunks.articleId, articleId));

            // Chunk the text
            const chunks = this.chunkText(content);

            // Generate embeddings for each chunk
            for (let i = 0; i < chunks.length; i++) {
                const embedding = await this.generateEmbedding(db, chunks[i]!);

                await db.insert(chatKnowledgeChunks).values({
                    articleId,
                    clinicId,
                    content: chunks[i]!,
                    chunkIndex: i,
                    embedding: embedding as any,
                    tokenCount: this.estimateTokens(chunks[i]!),
                });
            }

            // Mark article as processed
            await db
                .update(chatKnowledgeArticles)
                .set({
                    isProcessed: true,
                    chunkCount: chunks.length,
                    updatedAt: new Date(),
                })
                .where(eq(chatKnowledgeArticles.id, articleId));

            logger.info({ articleId, chunkCount: chunks.length }, 'Article embeddings processed');
        } catch (error) {
            logger.error({ error, articleId }, 'Failed to process article embeddings');
            throw error;
        }
    }

    /**
     * Generate embedding vector using OpenAI text-embedding-3-small.
     */
    static async generateEmbedding(db: Database, text: string): Promise<number[]> {
        const apiKey = config.openai.apiKey;
        if (!apiKey) {
            throw new Error('OPENAI_API_KEY is not configured');
        }

        const response = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                input: text,
                model: 'text-embedding-3-small',
            }),
        });

        const data = await response.json() as any;

        if (!response.ok) {
            throw new Error(`OpenAI Embedding API error: ${data.error?.message || response.status}`);
        }

        return data.data[0].embedding;
    }

    // ========================================================================
    // Semantic Search (RAG)
    // ========================================================================

    /**
     * Search for the most relevant knowledge chunks using cosine similarity.
     * Returns the top-K most similar chunks for a given query.
     */
    static async searchRelevantChunks(db: Database,
        clinicId: string,
        query: string,
        topK: number = 5
    ): Promise<{ content: string; similarity: number; articleTitle: string }[]> {
        try {
            const queryEmbedding = await this.generateEmbedding(db, query);
            const embeddingStr = `[${queryEmbedding.join(',')}]`;

            // Use pgvector cosine similarity operator (<=>)
            const results = await db.execute(sql`
                SELECT
                    c.content,
                    c.embedding <=> ${embeddingStr}::vector AS distance,
                    a.title AS article_title
                FROM chat_knowledge_chunks c
                JOIN chat_knowledge_articles a ON a.id = c.article_id
                JOIN chat_knowledge_bases kb ON kb.id = a.knowledge_base_id
                WHERE c.clinic_id = ${clinicId}
                  AND kb.is_active = true
                  AND c.embedding IS NOT NULL
                ORDER BY distance ASC
                LIMIT ${topK}
            `);

            // Drizzle with postgres-js returns results as an array directly
            const rows = Array.isArray(results) ? results : (results as any).rows || [];

            return rows.map((row: any) => ({
                content: row.content,
                similarity: 1 - parseFloat(row.distance), // Convert distance to similarity
                articleTitle: row.article_title,
            }));
        } catch (error) {
            logger.error({ error: error instanceof Error ? { message: error.message, stack: error.stack } : error, clinicId }, 'Failed to search knowledge chunks');
            return [];
        }
    }

    // ========================================================================
    // PDF Processing (GPT-4 Vision Pipeline)
    // ========================================================================

    /**
     * Convert each PDF page to a PNG image buffer using pdftoppm (Poppler).
     * Uses the full Poppler/Cairo rendering engine which handles all PDF types
     * including embedded fonts, images, tables, and complex layouts.
     * Renders at 300 DPI for clear text recognition.
     */
    static async pdfToImages(db: Database, buffer: Buffer): Promise<Buffer[]> {
        const { execFile } = await import('child_process');
        const { promisify } = await import('util');
        const fs = await import('fs');
        const path = await import('path');
        const os = await import('os');

        const execFileAsync = promisify(execFile);

        // Write PDF buffer to a temp file (pdftoppm needs a file path)
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-vision-'));
        const pdfPath = path.join(tmpDir, 'input.pdf');
        const outputPrefix = path.join(tmpDir, 'page');

        try {
            fs.writeFileSync(pdfPath, buffer);

            // Use pdftoppm to convert PDF pages to PNG images at 300 DPI
            await execFileAsync('pdftoppm', [
                '-png',      // Output PNG format
                '-r', '200', // 200 DPI (good quality, reasonable file size)
                pdfPath,
                outputPrefix,
            ]);

            // Read all generated PNG files (named page-01.png, page-02.png, etc.)
            const files = fs.readdirSync(tmpDir)
                .filter((f: string) => f.startsWith('page-') && f.endsWith('.png'))
                .sort();

            const images: Buffer[] = [];
            for (const file of files) {
                const imgPath = path.join(tmpDir, file);
                const imgBuffer = fs.readFileSync(imgPath);
                images.push(imgBuffer);
                logger.debug({ file, pngSize: imgBuffer.length }, 'PDF page rendered to image');
            }

            logger.info({ totalPages: images.length }, 'PDF converted to images via pdftoppm');
            return images;
        } finally {
            // Clean up temp files
            try {
                const tmpFiles = fs.readdirSync(tmpDir);
                for (const f of tmpFiles) {
                    fs.unlinkSync(path.join(tmpDir, f));
                }
                fs.rmdirSync(tmpDir);
            } catch (e) { /* ignore cleanup errors */ }
        }
    }

    /**
     * Send page images to GPT-4o Vision for structured text extraction.
     * Groups up to 4 pages per API call to reduce costs.
     */
    static async extractTextWithVision(db: Database, images: Buffer[]): Promise<string> {
        const apiKey = config.openai.apiKey;
        if (!apiKey) {
            throw new Error('OPENAI_API_KEY is not configured');
        }

        const PAGES_PER_BATCH = 4;
        const allTexts: string[] = [];

        for (let i = 0; i < images.length; i += PAGES_PER_BATCH) {
            const batch = images.slice(i, i + PAGES_PER_BATCH);
            const pageRange = `${i + 1}-${Math.min(i + PAGES_PER_BATCH, images.length)}`;

            const imageContent = batch.map((img, idx) => ([
                {
                    type: 'text' as const,
                    text: `--- Página ${i + idx + 1} ---`,
                },
                {
                    type: 'image_url' as const,
                    image_url: {
                        url: `data:image/png;base64,${img.toString('base64')}`,
                        detail: 'high' as const,
                    },
                },
            ])).flat();

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'gpt-4o',
                    messages: [
                        {
                            role: 'system',
                            content: `Eres un extractor de texto profesional. Tu tarea es extraer TODO el contenido de las páginas PDF proporcionadas.

Reglas:
- Extrae ABSOLUTAMENTE todo el texto visible, sin omitir nada
- Mantén las tablas como tablas Markdown (| col1 | col2 |)
- Preserva precios, números de teléfono y datos numéricos EXACTAMENTE como aparecen
- Mantén la estructura: títulos, subtítulos, listas, párrafos
- Si hay catálogos de productos, asocia cada producto con su precio/descripción correctamente  
- No añadas comentarios, explicaciones ni texto que no esté en el documento original
- Devuelve SOLO el texto extraído`,
                        },
                        {
                            role: 'user',
                            content: [
                                {
                                    type: 'text',
                                    text: `Extrae todo el texto de las siguientes ${batch.length} página(s) del PDF:`,
                                },
                                ...imageContent,
                            ],
                        },
                    ],
                    max_tokens: 4096,
                    temperature: 0,
                }),
            });

            const data = await response.json() as any;

            if (!response.ok) {
                throw new Error(`OpenAI Vision API error: ${data.error?.message || response.status}`);
            }

            const text = data.choices?.[0]?.message?.content || '';
            allTexts.push(text);

            logger.info({
                pages: pageRange,
                tokensUsed: data.usage?.total_tokens,
                textLength: text.length,
            }, 'Vision extraction completed for page batch');
        }

        return allTexts.join('\n\n');
    }

    /**
     * Extract text from a PDF buffer using GPT-4 Vision pipeline.
     * Converts pages to images → sends to GPT-4o Vision → returns structured text.
     * Falls back to basic pdf-parse for simple text extraction if Vision fails.
     */
    static async parsePdf(db: Database, buffer: Buffer): Promise<string> {
        try {
            // Step 1: Convert PDF pages to images
            logger.info('Starting PDF Vision extraction pipeline...');
            const images = await this.pdfToImages(db, buffer);

            if (images.length === 0) {
                throw new Error('No pages found in PDF');
            }

            // Step 2: Extract text with GPT-4o Vision
            const text = await this.extractTextWithVision(db, images);

            if (!text.trim()) {
                throw new Error('Vision extraction returned empty text');
            }

            logger.info({
                pages: images.length,
                textLength: text.length,
            }, 'PDF Vision extraction completed successfully');

            return text;
        } catch (error) {
            logger.warn(
                { error: error instanceof Error ? { message: error.message } : error },
                'Vision pipeline failed, falling back to basic pdf-parse'
            );

            // Fallback: basic text extraction with pdf-parse v1
            try {
                const pdfParse = (await import('pdf-parse' as any)).default;
                const result = await pdfParse(buffer);
                return result.text;
            } catch (fallbackError) {
                logger.error(
                    { error: fallbackError instanceof Error ? { message: fallbackError.message, stack: fallbackError.stack } : fallbackError },
                    'PDF fallback extraction also failed'
                );
                throw new Error('Failed to extract text from PDF');
            }
        }
    }
}
