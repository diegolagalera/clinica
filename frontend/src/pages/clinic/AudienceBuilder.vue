<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ArrowPathIcon, ArrowLeftIcon, XMarkIcon, PlusIcon } from '@heroicons/vue/24/outline';
import { 
    getAudienceSegment,
    createAudienceSegment,
    updateAudienceSegment,
    getAvailableFilters,
    previewSegmentFilters,
    type SegmentFilter,
    type FilterOption,
    type SegmentPreview,
} from '../../services/marketing';
import { toast } from '../../composables/useToast';

const router = useRouter();
const route = useRoute();

const segmentId = ref<string | null>(route.params.id as string || null);
const isEditMode = ref(!!segmentId.value);
const loading = ref(true);
const saving = ref(false);
const previewing = ref(false);

// Form
const name = ref('');
const description = ref('');
const filters = ref<SegmentFilter[]>([]);

// Resources
const filterOptions = ref<FilterOption[]>([]);
const preview = ref<SegmentPreview | null>(null);

const operatorLabels: Record<string, string> = {
    'eq': 'es igual a',
    'neq': 'no es igual a',
    'gt': 'mayor que',
    'gte': 'mayor o igual a',
    'lt': 'menor que',
    'lte': 'menor o igual a',
    'contains': 'contiene',
    'notContains': 'no contiene',
    'startsWith': 'empieza con',
    'endsWith': 'termina con',
    'isNull': 'está vacío',
    'isNotNull': 'no está vacío',
    'between': 'entre',
    'in': 'uno de',
};

const canSave = computed(() => 
    name.value.trim() && filters.value.length > 0
);

const loadResources = async () => {
    try {
        filterOptions.value = await getAvailableFilters();
    } catch (error: any) {
        toast.error('Error al cargar opciones de filtros');
    }
};

const loadSegment = async () => {
    if (!segmentId.value) {
        loading.value = false;
        return;
    }

    try {
        const segment = await getAudienceSegment(segmentId.value);
        name.value = segment.name;
        description.value = segment.description || '';
        filters.value = segment.filters || [];
    } catch (error: any) {
        toast.error('Error al cargar segmento');
        router.push('/clinic/marketing');
    } finally {
        loading.value = false;
    }
};

const addFilter = () => {
    if (filterOptions.value.length === 0) return;
    
    const firstOption = filterOptions.value[0];
    filters.value.push({
        field: firstOption.field,
        operator: firstOption.operators[0] || 'eq',
        value: '',
    });
};

const removeFilter = (index: number) => {
    filters.value.splice(index, 1);
    updatePreview();
};

const getFieldOption = (field: string): FilterOption | undefined => {
    return filterOptions.value.find(f => f.field === field);
};

const onFieldChange = (filter: SegmentFilter) => {
    const option = getFieldOption(filter.field);
    if (option) {
        filter.operator = option.operators[0] || 'eq';
        filter.value = '';
    }
};

const updatePreview = async () => {
    if (filters.value.length === 0) {
        preview.value = null;
        return;
    }

    const validFilters = filters.value.filter(f => 
        f.operator === 'isNull' || 
        f.operator === 'isNotNull' || 
        f.value
    );

    if (validFilters.length === 0) {
        preview.value = null;
        return;
    }

    previewing.value = true;
    try {
        preview.value = await previewSegmentFilters(validFilters, 10);
    } catch (error: any) {
        console.error('Preview error:', error);
    } finally {
        previewing.value = false;
    }
};

let previewTimeout: number | null = null;
watch(filters, () => {
    if (previewTimeout) clearTimeout(previewTimeout);
    previewTimeout = window.setTimeout(updatePreview, 500);
}, { deep: true });

const handleSave = async () => {
    if (!name.value.trim()) {
        toast.error('El nombre es requerido');
        return;
    }
    if (filters.value.length === 0) {
        toast.error('Añade al menos un filtro');
        return;
    }

    saving.value = true;

    try {
        const segmentData = {
            name: name.value,
            description: description.value || undefined,
            filters: filters.value,
        };

        if (isEditMode.value && segmentId.value) {
            await updateAudienceSegment(segmentId.value, segmentData);
            toast.success('Segmento actualizado');
        } else {
            await createAudienceSegment(segmentData);
            toast.success('Segmento creado');
        }
        router.push('/clinic/marketing');
    } catch (error: any) {
        toast.error('Error al guardar segmento');
    } finally {
        saving.value = false;
    }
};

onMounted(async () => {
    await loadResources();
    await loadSegment();
});
</script>

<template>
    <div class="space-y-6">
        <!-- Header -->
        <div class="flex items-center justify-between">
            <div class="flex items-center gap-4">
                <button 
                    class="p-2 hover:bg-surface-100 rounded-lg transition-colors"
                    @click="router.push('/clinic/marketing')"
                >
                    <ArrowLeftIcon class="w-5 h-5 text-surface-500" />
                </button>
                <h1 class="text-2xl font-bold text-surface-900">
                    {{ isEditMode ? 'Editar Segmento' : 'Nuevo Segmento' }}
                </h1>
            </div>
            <button 
                class="btn-primary"
                @click="handleSave" 
                :disabled="!canSave || saving"
            >
                {{ saving ? 'Guardando...' : '💾 Guardar segmento' }}
            </button>
        </div>

        <!-- Loading -->
        <div v-if="loading" class="flex justify-center py-12">
            <ArrowPathIcon class="w-8 h-8 animate-spin text-primary-600" />
        </div>

        <div v-else class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <!-- Main Form -->
            <div class="lg:col-span-2 space-y-6">
                <!-- Basic Info -->
                <div class="card p-6">
                    <h2 class="text-lg font-semibold text-surface-900 mb-4">Información</h2>
                    
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-surface-700 mb-1">
                                Nombre del segmento *
                            </label>
                            <input 
                                v-model="name" 
                                type="text" 
                                placeholder="Ej: Pacientes activos mayores de 30"
                                class="input"
                            />
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-surface-700 mb-1">
                                Descripción (opcional)
                            </label>
                            <textarea 
                                v-model="description" 
                                placeholder="Describe este segmento..."
                                class="input"
                                rows="2"
                            ></textarea>
                        </div>
                    </div>
                </div>

                <!-- Filters -->
                <div class="card p-6">
                    <div class="flex items-center justify-between mb-4">
                        <h2 class="text-lg font-semibold text-surface-900">🎯 Filtros</h2>
                        <button 
                            class="btn-primary btn-sm flex items-center gap-1"
                            @click="addFilter"
                        >
                            <PlusIcon class="w-4 h-4" />
                            Añadir filtro
                        </button>
                    </div>

                    <div v-if="filters.length === 0" class="text-center py-12 bg-surface-50 rounded-xl">
                        <div class="w-16 h-16 bg-surface-200 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span class="text-3xl">🎯</span>
                        </div>
                        <p class="text-surface-600 font-medium">No hay filtros configurados</p>
                        <p class="text-sm text-surface-400 mt-1">Los filtros te permiten seleccionar pacientes específicos</p>
                    </div>

                    <div v-else class="space-y-3">
                        <div 
                            v-for="(filter, index) in filters" 
                            :key="index"
                            class="flex flex-wrap items-center gap-2 p-4 bg-surface-50 rounded-xl"
                        >
                            <span v-if="index > 0" class="w-8 text-center text-xs font-bold text-primary-600 bg-primary-100 rounded px-2 py-1">
                                Y
                            </span>
                            
                            <!-- Field select -->
                            <select 
                                v-model="filter.field" 
                                class="select flex-1 min-w-[150px]"
                                @change="onFieldChange(filter)"
                            >
                                <option 
                                    v-for="opt in filterOptions" 
                                    :key="opt.field" 
                                    :value="opt.field"
                                >
                                    {{ opt.label }}
                                </option>
                            </select>

                            <!-- Operator select -->
                            <select v-model="filter.operator" class="select min-w-[120px]">
                                <option 
                                    v-for="op in getFieldOption(filter.field)?.operators || []" 
                                    :key="op" 
                                    :value="op"
                                >
                                    {{ operatorLabels[op] || op }}
                                </option>
                            </select>

                            <!-- Value input -->
                            <template v-if="filter.operator !== 'isNull' && filter.operator !== 'isNotNull'">
                                <!-- Dropdown for options -->
                                <select 
                                    v-if="getFieldOption(filter.field)?.options"
                                    v-model="filter.value" 
                                    class="select flex-1 min-w-[120px]"
                                >
                                    <option value="">-- Seleccionar --</option>
                                    <option 
                                        v-for="opt in getFieldOption(filter.field)?.options" 
                                        :key="opt.value" 
                                        :value="opt.value"
                                    >
                                        {{ opt.label }}
                                    </option>
                                </select>

                                <!-- Number input -->
                                <input 
                                    v-else-if="getFieldOption(filter.field)?.valueType === 'number'"
                                    v-model.number="filter.value" 
                                    type="number"
                                    class="input flex-1 min-w-[100px]"
                                    placeholder="Valor"
                                />

                                <!-- Date input -->
                                <input 
                                    v-else-if="getFieldOption(filter.field)?.valueType === 'date'"
                                    v-model="filter.value" 
                                    type="date"
                                    class="input flex-1 min-w-[140px]"
                                />

                                <!-- Text input (default) -->
                                <input 
                                    v-else
                                    v-model="filter.value" 
                                    type="text"
                                    class="input flex-1 min-w-[100px]"
                                    placeholder="Valor"
                                />

                                <!-- Second value for between -->
                                <input 
                                    v-if="filter.operator === 'between'"
                                    v-model="filter.value2" 
                                    :type="getFieldOption(filter.field)?.valueType === 'number' ? 'number' : 'text'"
                                    class="input min-w-[100px]"
                                    placeholder="Hasta"
                                />
                            </template>

                            <!-- Remove button -->
                            <button 
                                class="p-2 text-red-500 hover:bg-red-100 rounded-lg transition-colors"
                                @click="removeFilter(index)" 
                                title="Eliminar"
                            >
                                <XMarkIcon class="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Preview Sidebar -->
            <div class="space-y-6">
                <div class="card p-6">
                    <h3 class="font-semibold text-surface-900 mb-4">Vista previa</h3>
                    
                    <div v-if="previewing" class="flex items-center justify-center gap-2 py-8 text-surface-500">
                        <ArrowPathIcon class="w-5 h-5 animate-spin" />
                        <span>Calculando...</span>
                    </div>

                    <div v-else-if="!preview" class="text-center py-8 text-surface-400">
                        <p>Añade filtros para ver los pacientes que coinciden</p>
                    </div>

                    <div v-else>
                        <div class="text-center py-4 bg-primary-50 rounded-xl mb-4">
                            <span class="text-3xl font-bold text-primary-600">{{ preview.count }}</span>
                            <p class="text-sm text-surface-500">pacientes</p>
                        </div>

                        <div v-if="preview.patients.length > 0">
                            <h4 class="text-xs font-medium text-surface-400 uppercase mb-2">Muestra:</h4>
                            <div class="space-y-2">
                                <div 
                                    v-for="patient in preview.patients" 
                                    :key="patient.id"
                                    class="py-2 border-b border-surface-100 last:border-0"
                                >
                                    <p class="font-medium text-surface-900 text-sm">
                                        {{ patient.firstName }} {{ patient.lastName }}
                                    </p>
                                    <p class="text-xs text-surface-400">{{ patient.email || '(sin email)' }}</p>
                                </div>
                            </div>
                            <p v-if="preview.count > 10" class="text-center text-xs text-surface-400 mt-3">
                                +{{ preview.count - 10 }} más
                            </p>
                        </div>
                    </div>
                </div>

                <div class="card p-6 bg-blue-50 border-blue-200">
                    <h4 class="font-medium text-blue-800 mb-2">💡 Consejos</h4>
                    <ul class="text-sm text-blue-700 space-y-1">
                        <li>• Combina varios filtros para ser más específico</li>
                        <li>• Los filtros se aplican con lógica "Y"</li>
                        <li>• Revisa la vista previa antes de guardar</li>
                    </ul>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.card {
    background: white;
    border-radius: 0.75rem;
    border: 1px solid #e5e7eb;
}

.input, .select {
    padding: 0.5rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    background: white;
    transition: border-color 0.2s, box-shadow 0.2s;
}

.input:focus, .select:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.btn-sm {
    padding: 0.375rem 0.75rem;
    font-size: 0.875rem;
}
</style>
