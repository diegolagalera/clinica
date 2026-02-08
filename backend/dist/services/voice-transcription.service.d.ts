export interface TranscriptionResult {
    title: string;
    content: string;
    diagnosis: string;
    treatment: string;
    rawTranscription: string;
}
/**
 * Transcribe audio using OpenAI Whisper API
 */
export declare const transcribeAudio: (audioBuffer: Buffer, filename?: string) => Promise<string>;
/**
 * Extract structured fields from transcription using GPT-4
 */
export declare const extractFieldsFromTranscription: (transcription: string) => Promise<TranscriptionResult>;
/**
 * Full pipeline: transcribe audio and extract fields
 */
export declare const processVoiceRecording: (audioBuffer: Buffer, filename?: string) => Promise<TranscriptionResult>;
//# sourceMappingURL=voice-transcription.service.d.ts.map