<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowPathIcon, ArrowLeftIcon } from '@heroicons/vue/24/outline';
import { 
    getBirthdaySettings,
    updateBirthdaySettings,
    sendTestBirthdayEmail,
    getTodaysBirthdayPatients,
    getMarketingTemplates,
    type BirthdaySettings,
    type MarketingTemplate 
} from '../../services/marketing';
import { toast } from '../../composables/useToast';

const router = useRouter();

const loading = ref(true);
const saving = ref(false);
const sendingTest = ref(false);

// Settings
const settings = ref<BirthdaySettings>({
    id: null,
    clinicId: '',
    isEnabled: false,
    templateId: null,
    sendHour: 9,
    daysInAdvance: 0,
    createdAt: null,
    updatedAt: null,
});

// Templates for selection
const templates = ref<MarketingTemplate[]>([]);
const birthdayTemplates = computed(() => 
    templates.value.filter(t => t.category === 'birthday' || !t.isSystemTemplate)
);

// Today's birthdays preview
const todaysBirthdays = ref<any[]>([]);

// Test email
const testEmail = ref('');

const hourOptions = Array.from({ length: 24 }, (_, i) => ({
    value: i,
    label: `${i.toString().padStart(2, '0')}:00`,
}));

const daysOptions = [
    { value: 0, label: 'El mismo día' },
    { value: 1, label: '1 día antes' },
    { value: 2, label: '2 días antes' },
    { value: 3, label: '3 días antes' },
    { value: 7, label: '1 semana antes' },
];

const loadData = async () => {
    loading.value = true;
    try {
        const [settingsData, templatesData, birthdaysData] = await Promise.all([
            getBirthdaySettings(),
            getMarketingTemplates(),
            getTodaysBirthdayPatients(),
        ]);
        settings.value = settingsData;
        templates.value = templatesData;
        todaysBirthdays.value = birthdaysData;
    } catch (error: any) {
        toast.error('Error al cargar configuración');
    } finally {
        loading.value = false;
    }
};

const handleSave = async () => {
    saving.value = true;
    try {
        await updateBirthdaySettings({
            isEnabled: settings.value.isEnabled,
            templateId: settings.value.templateId,
            sendHour: settings.value.sendHour,
            daysInAdvance: settings.value.daysInAdvance,
        });
        toast.success('Configuración guardada');
    } catch (error: any) {
        toast.error('Error al guardar');
    } finally {
        saving.value = false;
    }
};

const handleSendTest = async () => {
    if (!testEmail.value.trim()) {
        toast.error('Introduce un email de prueba');
        return;
    }

    if (!settings.value.templateId) {
        toast.error('Selecciona una plantilla primero');
        return;
    }

    sendingTest.value = true;
    try {
        await sendTestBirthdayEmail(testEmail.value);
        toast.success('Email de prueba enviado');
        testEmail.value = '';
    } catch (error: any) {
        toast.error('Error al enviar email de prueba');
    } finally {
        sendingTest.value = false;
    }
};

onMounted(loadData);
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
                <div>
                    <h1 class="text-2xl font-bold text-surface-900">🎂 Emails de Cumpleaños</h1>
                    <p class="text-surface-500 mt-1">Envía felicitaciones automáticas a tus pacientes</p>
                </div>
            </div>
            <button 
                class="btn-primary"
                @click="handleSave" 
                :disabled="saving"
            >
                {{ saving ? 'Guardando...' : '💾 Guardar' }}
            </button>
        </div>

        <!-- Loading -->
        <div v-if="loading" class="flex justify-center py-12">
            <ArrowPathIcon class="w-8 h-8 animate-spin text-primary-600" />
        </div>

        <div v-else class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <!-- Main Settings -->
            <div class="lg:col-span-2 space-y-6">
                <!-- Enable Toggle -->
                <div class="card p-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <h2 class="text-lg font-semibold text-surface-900">Activar emails de cumpleaños</h2>
                            <p class="text-surface-500 text-sm mt-1">
                                Envía automáticamente felicitaciones por email a los pacientes en su cumpleaños
                            </p>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                v-model="settings.isEnabled" 
                                class="sr-only peer"
                            />
                            <div class="w-14 h-7 bg-surface-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-primary-600"></div>
                        </label>
                    </div>
                </div>

                <!-- Template Selection -->
                <div class="card p-6">
                    <h2 class="text-lg font-semibold text-surface-900 mb-4">📝 Plantilla de email</h2>
                    
                    <div v-if="birthdayTemplates.length === 0" class="text-center py-8">
                        <p class="text-surface-500 mb-3">No tienes plantillas de cumpleaños.</p>
                        <button 
                            class="text-primary-600 hover:text-primary-700 font-medium"
                            @click="router.push('/clinic/marketing/templates')"
                        >
                            Ir a la biblioteca de plantillas →
                        </button>
                    </div>

                    <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div 
                            v-for="t in birthdayTemplates" 
                            :key="t.id"
                            :class="[
                                'p-4 rounded-xl border-2 cursor-pointer transition-all',
                                settings.templateId === t.id 
                                    ? 'border-primary-500 bg-primary-50' 
                                    : 'border-surface-200 hover:border-surface-300'
                            ]"
                            @click="settings.templateId = t.id"
                        >
                            <div class="flex items-start gap-3">
                                <span class="text-2xl">🎂</span>
                                <div class="flex-1 min-w-0">
                                    <h4 class="font-medium text-surface-900 truncate">{{ t.name }}</h4>
                                    <p class="text-sm text-surface-500 truncate">{{ t.subject }}</p>
                                </div>
                                <div v-if="settings.templateId === t.id" class="text-primary-600 font-bold">✓</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Timing Settings -->
                <div class="card p-6">
                    <h2 class="text-lg font-semibold text-surface-900 mb-4">⏰ Configuración de envío</h2>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-surface-700 mb-1">
                                Hora de envío
                            </label>
                            <select v-model.number="settings.sendHour" class="input">
                                <option v-for="h in hourOptions" :key="h.value" :value="h.value">
                                    {{ h.label }}
                                </option>
                            </select>
                            <p class="text-xs text-surface-400 mt-1">El email se enviará a esta hora</p>
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-surface-700 mb-1">
                                Cuándo enviar
                            </label>
                            <select v-model.number="settings.daysInAdvance" class="input">
                                <option v-for="d in daysOptions" :key="d.value" :value="d.value">
                                    {{ d.label }}
                                </option>
                            </select>
                            <p class="text-xs text-surface-400 mt-1">Días antes del cumpleaños</p>
                        </div>
                    </div>
                </div>

                <!-- Test Email -->
                <div class="card p-6 bg-blue-50 border-blue-200">
                    <h2 class="text-lg font-semibold text-blue-800 mb-4">🧪 Enviar email de prueba</h2>
                    
                    <div class="flex gap-3">
                        <input 
                            v-model="testEmail" 
                            type="email" 
                            placeholder="tu@email.com"
                            class="input flex-1"
                        />
                        <button 
                            @click="handleSendTest"
                            :disabled="sendingTest || !settings.templateId"
                            class="btn-primary whitespace-nowrap"
                        >
                            {{ sendingTest ? 'Enviando...' : 'Enviar prueba' }}
                        </button>
                    </div>
                    <p v-if="!settings.templateId" class="text-sm text-blue-600 mt-2">
                        Selecciona una plantilla primero
                    </p>
                </div>
            </div>

            <!-- Sidebar -->
            <div class="space-y-6">
                <!-- Status Card -->
                <div :class="[
                    'card p-6',
                    settings.isEnabled ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'
                ]">
                    <div class="text-center">
                        <span class="text-4xl">{{ settings.isEnabled ? '✅' : '⏸️' }}</span>
                        <h3 :class="[
                            'text-lg font-semibold mt-2',
                            settings.isEnabled ? 'text-green-800' : 'text-yellow-800'
                        ]">
                            {{ settings.isEnabled ? 'Activo' : 'Pausado' }}
                        </h3>
                        <p :class="[
                            'text-sm mt-1',
                            settings.isEnabled ? 'text-green-600' : 'text-yellow-600'
                        ]">
                            {{ settings.isEnabled 
                                ? 'Los emails se enviarán automáticamente' 
                                : 'Activa para comenzar a enviar' 
                            }}
                        </p>
                    </div>
                </div>

                <!-- Today's Birthdays -->
                <div class="card p-6">
                    <h3 class="font-semibold text-surface-900 mb-4">🎉 Cumpleaños hoy</h3>
                    
                    <div v-if="todaysBirthdays.length === 0" class="text-center py-4">
                        <p class="text-surface-400">No hay cumpleaños hoy</p>
                    </div>
                    
                    <div v-else class="space-y-3">
                        <div 
                            v-for="patient in todaysBirthdays" 
                            :key="patient.id"
                            class="flex items-center gap-3 p-3 bg-surface-50 rounded-lg"
                        >
                            <span class="text-2xl">🎂</span>
                            <div>
                                <p class="font-medium text-surface-900">
                                    {{ patient.firstName }} {{ patient.lastName }}
                                </p>
                                <p class="text-xs text-surface-500">{{ patient.email || 'Sin email' }}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Info Box -->
                <div class="card p-6 bg-surface-50">
                    <h4 class="font-medium text-surface-700 mb-2">💡 ¿Cómo funciona?</h4>
                    <ul class="text-sm text-surface-500 space-y-1">
                        <li>• El sistema revisa cumpleaños diariamente</li>
                        <li>• Solo se envía a pacientes con email</li>
                        <li>• Los pacientes que no aceptan marketing no recibirán el email</li>
                        <li>• Puedes ver el historial en el panel de marketing</li>
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

.input {
    width: 100%;
    padding: 0.625rem 0.875rem;
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    background: white;
    transition: border-color 0.2s, box-shadow 0.2s;
}

.input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}
</style>
