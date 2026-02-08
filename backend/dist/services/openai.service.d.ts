export interface RadiographAnalysisResult {
    summary: string;
    suspiciousAreas: SuspiciousArea[];
    confidence: number;
    recommendations: string[];
    rawResponse: unknown;
}
export interface SuspiciousArea {
    area: string;
    finding: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    description: string;
}
/**
 * Analyze a dental radiograph using OpenAI Vision API
 */
export declare const analyzeRadiograph: (imageBase64: string, mimeType?: string) => Promise<RadiographAnalysisResult>;
/**
 * Check if OpenAI service is available
 */
export declare const checkOpenAIHealth: () => Promise<boolean>;
export interface GeneratedImageResult {
    imageUrl: string;
    revisedPrompt: string;
}
/**
 * Generate a stock item image using DALL-E
 */
export declare const generateStockItemImage: (itemName: string, itemDescription?: string) => Promise<GeneratedImageResult>;
//# sourceMappingURL=openai.service.d.ts.map