<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { 
    getMarketingTemplate,
    createMarketingTemplate,
    updateMarketingTemplate,
    getTemplateVariables,
} from '../../services/marketing';
import { toast } from '../../composables/useToast';

const router = useRouter();
const route = useRoute();

const templateId = ref<string | null>(route.params.id as string || null);
const isEditMode = ref(!!templateId.value);
const loading = ref(true);
const saving = ref(false);

// Form data
const name = ref('');
const subject = ref('');
const category = ref('custom');
const previewText = ref('');
const designJson = ref<any>({});
const htmlContent = ref('');

// Unlayer editor ref
const emailEditorRef = ref<HTMLDivElement | null>(null);
let unlayerEditor: any = null;

// Available variables
const variables = ref<Record<string, string>>({});

const categories = [
    { value: 'birthday', label: '🎂 Cumpleaños' },
    { value: 'promo', label: '💰 Promociones' },
    { value: 'seasonal', label: '🗓️ Estacionales' },
    { value: 'educational', label: '📚 Educativas' },
    { value: 'reactivation', label: '⏰ Reactivación' },
    { value: 'onboarding', label: '🆕 Bienvenida' },
    { value: 'newsletter', label: '📰 Newsletter' },
    { value: 'custom', label: '✏️ Personalizada' },
];

const loadUnlayer = () => {
    return new Promise<void>((resolve) => {
        if ((window as any).unlayer) {
            resolve();
            return;
        }
        
        const script = document.createElement('script');
        script.src = 'https://editor.unlayer.com/embed.js';
        script.onload = () => resolve();
        document.head.appendChild(script);
    });
};

const initEditor = async () => {
    await loadUnlayer();
    
    if (!emailEditorRef.value) return;

    (window as any).unlayer.init({
        id: 'email-editor',
        projectId: 1234, // Optional: your Unlayer project ID
        displayMode: 'email',
        appearance: {
            theme: 'modern_light',
            panels: {
                tools: {
                    dock: 'left',
                },
            },
        },
        tools: {
            form: { enabled: false },
        },
        features: {
            preview: true,
            imageEditor: true,
            undoRedo: true,
        },
        mergeTags: Object.entries(variables.value).map(([key, desc]) => ({
            name: desc,
            value: `{{${key}}}`,
        })),
    });

    unlayerEditor = (window as any).unlayer;

    // Load existing design if editing
    if (isEditMode.value && Object.keys(designJson.value).length > 0) {
        unlayerEditor.loadDesign(designJson.value);
    }

    unlayerEditor.addEventListener('design:updated', () => {
        // Auto-save could be implemented here
    });
};

const loadTemplate = async () => {
    if (!templateId.value) {
        loading.value = false;
        return;
    }

    try {
        const template = await getMarketingTemplate(templateId.value);
        name.value = template.name;
        subject.value = template.subject;
        category.value = template.category || 'custom';
        previewText.value = template.previewText || '';
        designJson.value = template.designJson || {};
        htmlContent.value = template.htmlContent || '';
    } catch (error: any) {
        toast.error('Error al cargar plantilla');
        router.push('/clinic/marketing/templates');
    } finally {
        loading.value = false;
    }
};

const loadVariables = async () => {
    try {
        variables.value = await getTemplateVariables();
    } catch (error) {
        console.error('Error loading variables:', error);
    }
};

const exportDesign = (): Promise<{ design: any; html: string }> => {
    return new Promise((resolve) => {
        unlayerEditor.exportHtml((data: any) => {
            resolve({ design: data.design, html: data.html });
        });
    });
};

const handleSave = async () => {
    if (!name.value.trim()) {
        toast.error('El nombre es requerido');
        return;
    }
    if (!subject.value.trim()) {
        toast.error('El asunto es requerido');
        return;
    }

    saving.value = true;

    try {
        const { design, html } = await exportDesign();

        const templateData = {
            name: name.value,
            subject: subject.value,
            category: category.value,
            previewText: previewText.value,
            designJson: design,
            htmlContent: html,
        };

        if (isEditMode.value && templateId.value) {
            await updateMarketingTemplate(templateId.value, templateData);
            toast.success('Plantilla actualizada');
        } else {
            const created = await createMarketingTemplate(templateData);
            toast.success('Plantilla creada');
            router.push(`/clinic/marketing/templates/${created.id}/edit`);
        }
    } catch (error: any) {
        toast.error('Error al guardar plantilla');
    } finally {
        saving.value = false;
    }
};

const handlePreview = async () => {
    const { html } = await exportDesign();
    
    // Open preview in new window
    const previewWindow = window.open('', '_blank', 'width=600,height=800');
    if (previewWindow) {
        previewWindow.document.write(html);
        previewWindow.document.close();
    }
};

const insertVariable = (varKey: string) => {
    // Copy to clipboard for user to paste
    navigator.clipboard.writeText(`{{${varKey}}}`);
    toast.success(`Variable copiada al portapapeles`);
};

const formatVarKey = (key: string | number) => {
    return '{{' + key + '}}';
};

onMounted(async () => {
    await loadVariables();
    await loadTemplate();
    await initEditor();
});
</script>

<template>
    <div class="template-editor">
        <!-- Header -->
        <div class="editor-header">
            <div class="header-left">
                <button class="back-btn" @click="router.push('/clinic/marketing/templates')">
                    ← Volver
                </button>
                <h1>{{ isEditMode ? 'Editar Plantilla' : 'Nueva Plantilla' }}</h1>
            </div>
            <div class="header-actions">
                <button class="btn-secondary" @click="handlePreview" :disabled="saving">
                    👁️ Vista previa
                </button>
                <button class="btn-primary" @click="handleSave" :disabled="saving">
                    {{ saving ? 'Guardando...' : '💾 Guardar' }}
                </button>
            </div>
        </div>

        <!-- Loading -->
        <div v-if="loading" class="loading-state">
            <div class="spinner"></div>
            <p>Cargando editor...</p>
        </div>

        <div v-else class="editor-content">
            <!-- Sidebar -->
            <div class="editor-sidebar">
                <div class="form-group">
                    <label>Nombre de la plantilla *</label>
                    <input 
                        v-model="name" 
                        type="text" 
                        placeholder="Ej: Promoción de Navidad"
                        class="form-input"
                    />
                </div>

                <div class="form-group">
                    <label>Asunto del email *</label>
                    <input 
                        v-model="subject" 
                        type="text" 
                        placeholder="Ej: 🎄 ¡Feliz Navidad, {{patient_first_name}}!"
                        class="form-input"
                    />
                </div>

                <div class="form-group">
                    <label>Categoría</label>
                    <select v-model="category" class="form-input">
                        <option v-for="cat in categories" :key="cat.value" :value="cat.value">
                            {{ cat.label }}
                        </option>
                    </select>
                </div>

                <div class="form-group">
                    <label>Texto de vista previa</label>
                    <input 
                        v-model="previewText" 
                        type="text" 
                        placeholder="Texto que aparece en la bandeja de entrada"
                        class="form-input"
                    />
                </div>

                <!-- Variables -->
                <div class="variables-section">
                    <h3>Variables disponibles</h3>
                    <p class="variables-hint">Haz clic para copiar</p>
                    <div class="variables-list">
                        <button 
                            v-for="(desc, key) in variables" 
                            :key="key"
                            class="variable-chip"
                            @click="insertVariable(String(key))"
                            :title="String(desc)"
                        >
                            {{ formatVarKey(key) }}
                        </button>
                    </div>
                </div>
            </div>

            <!-- Editor -->
            <div class="email-editor-wrapper">
                <div id="email-editor" ref="emailEditorRef"></div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.template-editor {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: var(--color-bg);
}

.editor-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 24px;
    background: var(--color-bg-card);
    border-bottom: 1px solid var(--color-border);
}

.header-left {
    display: flex;
    align-items: center;
    gap: 16px;
}

.back-btn {
    background: none;
    border: none;
    color: var(--color-text-secondary);
    cursor: pointer;
    font-size: 14px;
}

.editor-header h1 {
    font-size: 20px;
    font-weight: 600;
    margin: 0;
}

.header-actions {
    display: flex;
    gap: 12px;
}

.btn-primary {
    background: var(--color-primary);
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
}

.btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.btn-secondary {
    background: var(--color-bg-secondary);
    color: var(--color-text);
    border: 1px solid var(--color-border);
    padding: 10px 20px;
    border-radius: 8px;
    font-weight: 500;
    cursor: pointer;
}

.editor-content {
    display: flex;
    flex: 1;
    overflow: hidden;
}

.editor-sidebar {
    width: 320px;
    padding: 20px;
    background: var(--color-bg-card);
    border-right: 1px solid var(--color-border);
    overflow-y: auto;
}

.form-group {
    margin-bottom: 16px;
}

.form-group label {
    display: block;
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text);
    margin-bottom: 6px;
}

.form-input {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    font-size: 14px;
    background: var(--color-bg);
}

.form-input:focus {
    outline: none;
    border-color: var(--color-primary);
}

.variables-section {
    margin-top: 24px;
    padding-top: 20px;
    border-top: 1px solid var(--color-border);
}

.variables-section h3 {
    font-size: 14px;
    font-weight: 600;
    margin: 0 0 4px 0;
}

.variables-hint {
    font-size: 12px;
    color: var(--color-text-secondary);
    margin: 0 0 12px 0;
}

.variables-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}

.variable-chip {
    padding: 4px 10px;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: 16px;
    font-size: 12px;
    font-family: monospace;
    cursor: pointer;
    transition: all 0.2s;
}

.variable-chip:hover {
    background: var(--color-primary-light);
    border-color: var(--color-primary);
}

.email-editor-wrapper {
    flex: 1;
    overflow: hidden;
}

#email-editor {
    width: 100%;
    height: 100%;
    min-height: 600px;
}

.loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    gap: 16px;
}

.spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--color-border);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}
</style>
