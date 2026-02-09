<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { api } from '@/services/api'
import { useToast } from '@/composables/useToast'
import {
  BookOpenIcon,
  PlusIcon,
  TrashIcon,
  DocumentTextIcon,
  DocumentArrowUpIcon,
  XMarkIcon,
  SparklesIcon,
  PencilSquareIcon,
  EyeIcon,
} from '@heroicons/vue/24/outline'

const toast = useToast()

const knowledgeBases = ref<any[]>([])
const selectedKB = ref<any>(null)
const articles = ref<any[]>([])
const loadingArticles = ref(false)
const showNewKBModal = ref(false)
const showNewArticleModal = ref(false)
const showPdfUpload = ref(false)

// View/Edit article modal
const showArticleModal = ref(false)
const editingArticle = ref<any>(null)
const articleEditForm = ref({ title: '', content: '' })
const isEditMode = ref(false)
const savingArticle = ref(false)

const newKBForm = ref({ name: '', description: '' })
const newArticleForm = ref({ title: '', content: '' })
const pdfFile = ref<File | null>(null)
const pdfTitle = ref('')
const uploading = ref(false)

// Methods
const fetchKnowledgeBases = async () => {
  try {
    const res = await api.get<any>('/chatbot/knowledge')
    knowledgeBases.value = res.data || []
  } catch (err: any) {
    toast.error('Error cargando bases de conocimiento')
  }
}

const selectKB = async (kb: any) => {
  selectedKB.value = kb
  loadingArticles.value = true
  try {
    const res = await api.get<any>(`/chatbot/knowledge/${kb.id}/articles`)
    articles.value = res.data || []
  } catch (err: any) {
    toast.error('Error cargando artículos')
  } finally {
    loadingArticles.value = false
  }
}

const createKB = async () => {
  if (!newKBForm.value.name) return
  try {
    const res = await api.post<any>('/chatbot/knowledge', newKBForm.value)
    knowledgeBases.value.push(res.data)
    showNewKBModal.value = false
    newKBForm.value = { name: '', description: '' }
    toast.success('Base de conocimiento creada')
  } catch (err: any) {
    toast.error('Error creando base de conocimiento')
  }
}

const deleteKB = async (kb: any) => {
  if (!confirm(`¿Eliminar "${kb.name}" y todos sus artículos?`)) return
  try {
    await api.delete(`/chatbot/knowledge/${kb.id}`)
    knowledgeBases.value = knowledgeBases.value.filter(k => k.id !== kb.id)
    if (selectedKB.value?.id === kb.id) {
      selectedKB.value = null
      articles.value = []
    }
    toast.success('Base de conocimiento eliminada')
  } catch (err: any) {
    toast.error('Error eliminando base de conocimiento')
  }
}

const createArticle = async () => {
  if (!newArticleForm.value.title || !newArticleForm.value.content || !selectedKB.value) return
  try {
    const res = await api.post<any>(`/chatbot/knowledge/${selectedKB.value.id}/articles`, newArticleForm.value)
    articles.value.push(res.data)
    showNewArticleModal.value = false
    newArticleForm.value = { title: '', content: '' }
    toast.success('Artículo creado y procesado para RAG')
  } catch (err: any) {
    toast.error('Error creando artículo')
  }
}

const uploadPdf = async () => {
  if (!pdfFile.value || !selectedKB.value) return
  uploading.value = true
  try {
    const res = await api.upload<any>(
      `/chatbot/knowledge/${selectedKB.value.id}/articles/pdf`,
      pdfFile.value,
      'file',
      { title: pdfTitle.value || pdfFile.value.name }
    )
    articles.value.push(res.data)
    showPdfUpload.value = false
    pdfFile.value = null
    pdfTitle.value = ''
    toast.success('PDF procesado correctamente')
  } catch (err: any) {
    toast.error(err.message || 'Error procesando PDF')
  } finally {
    uploading.value = false
  }
}

const deleteArticle = async (article: any) => {
  if (!confirm(`¿Eliminar "${article.title}"?`)) return
  if (!selectedKB.value) return
  try {
    await api.delete(`/chatbot/knowledge/${selectedKB.value.id}/articles/${article.id}`)
    articles.value = articles.value.filter(a => a.id !== article.id)
    toast.success('Artículo eliminado')
  } catch (err: any) {
    toast.error('Error eliminando artículo')
  }
}

const openArticle = (article: any, edit = false) => {
  editingArticle.value = article
  articleEditForm.value = {
    title: article.title,
    content: article.originalContent || '',
  }
  isEditMode.value = edit
  showArticleModal.value = true
}

const saveArticle = async () => {
  if (!editingArticle.value || !selectedKB.value) return
  if (!articleEditForm.value.title || !articleEditForm.value.content) return
  savingArticle.value = true
  try {
    const res = await api.put<any>(
      `/chatbot/knowledge/${selectedKB.value.id}/articles/${editingArticle.value.id}`,
      { title: articleEditForm.value.title, content: articleEditForm.value.content }
    )
    // Update locally
    const idx = articles.value.findIndex(a => a.id === editingArticle.value.id)
    if (idx !== -1 && res.data) {
      articles.value[idx] = res.data
    }
    showArticleModal.value = false
    toast.success('Artículo actualizado. Los embeddings se regenerarán automáticamente.')
  } catch (err: any) {
    toast.error('Error actualizando artículo')
  } finally {
    savingArticle.value = false
  }
}

const handleFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement
  if (target.files?.[0]) {
    pdfFile.value = target.files[0]
    if (!pdfTitle.value) pdfTitle.value = target.files[0].name.replace('.pdf', '')
  }
}

const formatDate = (d: string) => {
  if (!d) return ''
  return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const totalChunks = computed(() => {
  return articles.value.reduce((acc, a) => acc + (a.chunkCount || 0), 0)
})

onMounted(fetchKnowledgeBases)
</script>

<template>
  <div class="max-w-6xl mx-auto space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-4">
        <router-link to="/clinic/whatsapp" class="p-2 hover:bg-surface-100 rounded-lg">
          <svg class="w-5 h-5 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </router-link>
        <div>
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
              <BookOpenIcon class="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 class="text-xl font-bold text-surface-900">Base de Conocimiento</h1>
              <p class="text-sm text-surface-500">Alimenta la IA del chatbot con información de tu clínica</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Info Card -->
    <div class="card p-4 bg-gradient-to-r from-primary-50 to-accent-50 border border-primary-100">
      <div class="flex items-start gap-3">
        <SparklesIcon class="w-6 h-6 text-primary-500 flex-shrink-0 mt-0.5" />
        <div>
          <h3 class="text-sm font-semibold text-primary-800">¿Cómo funciona?</h3>
          <p class="text-sm text-primary-600 mt-1">
            Sube artículos o PDFs con información sobre tu clínica: servicios, precios, horarios, FAQs.
            La IA troceará el contenido, generará embeddings y usará búsqueda semántica (RAG) para responder a los pacientes con información precisa.
          </p>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Left: KB List -->
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="font-semibold text-surface-800">Bases de conocimiento</h2>
          <button @click="showNewKBModal = true" class="btn-primary text-xs flex items-center gap-1 px-3 py-1.5">
            <PlusIcon class="w-4 h-4" /> Nueva
          </button>
        </div>

        <div v-if="knowledgeBases.length === 0" class="card p-6 text-center">
          <p class="text-sm text-surface-500">Sin bases de conocimiento</p>
          <p class="text-xs text-surface-400 mt-1">Crea una para empezar a añadir contenido.</p>
        </div>

        <div v-else class="space-y-2">
          <button
            v-for="kb in knowledgeBases"
            :key="kb.id"
            @click="selectKB(kb)"
            :class="[
              'w-full p-3 rounded-xl text-left transition-all border',
              selectedKB?.id === kb.id
                ? 'bg-primary-50 border-primary-200 ring-1 ring-primary-300'
                : 'bg-white border-surface-200 hover:border-primary-200'
            ]"
          >
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-medium text-surface-900">{{ kb.name }}</h3>
              <button @click.stop="deleteKB(kb)" class="p-1 hover:bg-danger-50 rounded">
                <TrashIcon class="w-3.5 h-3.5 text-surface-400 hover:text-danger-500" />
              </button>
            </div>
            <p class="text-[10px] text-surface-400 mt-1">{{ kb.articleCount || 0 }} artículos • {{ formatDate(kb.createdAt) }}</p>
          </button>
        </div>
      </div>

      <!-- Right: Articles -->
      <div class="lg:col-span-2">
        <div v-if="!selectedKB" class="card p-12 text-center">
          <BookOpenIcon class="w-16 h-16 mx-auto text-surface-300 mb-4" />
          <h3 class="text-lg font-semibold text-surface-700">Selecciona una base de conocimiento</h3>
          <p class="text-sm text-surface-400 mt-1">Para ver y gestionar sus artículos</p>
        </div>

        <div v-else class="space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="font-semibold text-surface-800">{{ selectedKB.name }}</h2>
              <p class="text-xs text-surface-400">{{ articles.length }} artículos • {{ totalChunks }} chunks RAG</p>
            </div>
            <div class="flex gap-2">
              <button @click="showPdfUpload = true" class="btn-secondary text-xs flex items-center gap-1 px-3 py-1.5">
                <DocumentArrowUpIcon class="w-4 h-4" /> Subir PDF
              </button>
              <button @click="showNewArticleModal = true" class="btn-primary text-xs flex items-center gap-1 px-3 py-1.5">
                <PlusIcon class="w-4 h-4" /> Nuevo Artículo
              </button>
            </div>
          </div>

          <div v-if="loadingArticles" class="card p-8 text-center">
            <p class="text-sm text-surface-400">Cargando artículos...</p>
          </div>

          <div v-else-if="articles.length === 0" class="card p-8 text-center">
            <p class="text-sm text-surface-500">Sin artículos</p>
            <p class="text-xs text-surface-400 mt-1">Añade artículos de texto o sube PDFs para alimentar la IA.</p>
          </div>

          <div v-else class="space-y-2">
            <div
              v-for="article in articles"
              :key="article.id"
              class="card p-4 hover:shadow-md transition-shadow cursor-pointer"
              @click="openArticle(article)"
            >
              <div class="flex items-start justify-between">
                <div class="flex items-center gap-3">
                  <div :class="[
                    'w-9 h-9 rounded-lg flex items-center justify-center',
                    article.sourceType === 'pdf' ? 'bg-red-100' : 'bg-blue-100'
                  ]">
                    <component
                      :is="article.sourceType === 'pdf' ? DocumentArrowUpIcon : DocumentTextIcon"
                      :class="['w-4 h-4', article.sourceType === 'pdf' ? 'text-red-600' : 'text-blue-600']"
                    />
                  </div>
                  <div>
                    <h3 class="font-medium text-sm text-surface-900">{{ article.title }}</h3>
                    <p class="text-[10px] text-surface-400">
                      {{ article.sourceType === 'pdf' ? 'PDF' : 'Texto' }}
                      • {{ article.chunkCount || 0 }} chunks
                      <template v-if="article.sourceType === 'pdf' && article.sourceFilename">
                        • {{ article.sourceFilename }}
                      </template>
                      • {{ formatDate(article.createdAt) }}
                    </p>
                  </div>
                </div>
                <div class="flex items-center gap-1">
                  <button @click.stop="openArticle(article, true)" class="p-1.5 hover:bg-primary-50 rounded" title="Editar">
                    <PencilSquareIcon class="w-4 h-4 text-surface-400 hover:text-primary-500" />
                  </button>
                  <button @click.stop="deleteArticle(article)" class="p-1.5 hover:bg-danger-50 rounded" title="Eliminar">
                    <TrashIcon class="w-4 h-4 text-surface-400 hover:text-danger-500" />
                  </button>
                </div>
              </div>
              <p v-if="article.originalContent" class="text-xs text-surface-500 mt-2 line-clamp-3">{{ article.originalContent }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- New KB Modal -->
    <Teleport to="body">
      <div v-if="showNewKBModal" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" @click.self="showNewKBModal = false">
        <div class="bg-white rounded-xl shadow-2xl max-w-md w-full">
          <div class="flex items-center justify-between p-4 border-b border-surface-200">
            <h3 class="font-semibold text-surface-900">Nueva Base de Conocimiento</h3>
            <button @click="showNewKBModal = false"><XMarkIcon class="w-5 h-5 text-surface-500" /></button>
          </div>
          <form @submit.prevent="createKB" class="p-4 space-y-4">
            <div>
              <label class="block text-sm font-medium text-surface-700 mb-1">Nombre</label>
              <input v-model="newKBForm.name" class="input w-full" placeholder="Ej: Servicios y precios" required />
            </div>
            <div>
              <label class="block text-sm font-medium text-surface-700 mb-1">Descripción <span class="text-surface-400">(Opcional)</span></label>
              <textarea v-model="newKBForm.description" class="input w-full" rows="3" placeholder="Descripción breve..."></textarea>
            </div>
            <div class="flex gap-3">
              <button type="button" @click="showNewKBModal = false" class="btn-secondary flex-1">Cancelar</button>
              <button type="submit" class="btn-primary flex-1">Crear</button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- New Article Modal -->
    <Teleport to="body">
      <div v-if="showNewArticleModal" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" @click.self="showNewArticleModal = false">
        <div class="bg-white rounded-xl shadow-2xl max-w-lg w-full">
          <div class="flex items-center justify-between p-4 border-b border-surface-200">
            <h3 class="font-semibold text-surface-900">Nuevo Artículo</h3>
            <button @click="showNewArticleModal = false"><XMarkIcon class="w-5 h-5 text-surface-500" /></button>
          </div>
          <form @submit.prevent="createArticle" class="p-4 space-y-4">
            <div>
              <label class="block text-sm font-medium text-surface-700 mb-1">Título</label>
              <input v-model="newArticleForm.title" class="input w-full" placeholder="Ej: Horarios de apertura" required />
            </div>
            <div>
              <label class="block text-sm font-medium text-surface-700 mb-1">Contenido</label>
              <textarea v-model="newArticleForm.content" class="input w-full" rows="8" placeholder="Escribe el contenido del artículo..." required></textarea>
              <p class="text-xs text-surface-400 mt-1">El texto se dividirá en chunks y se generarán embeddings automáticamente.</p>
            </div>
            <div class="flex gap-3">
              <button type="button" @click="showNewArticleModal = false" class="btn-secondary flex-1">Cancelar</button>
              <button type="submit" class="btn-primary flex-1">Crear y procesar</button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- View/Edit Article Modal -->
    <Teleport to="body">
      <div v-if="showArticleModal" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" @click.self="showArticleModal = false">
        <div class="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col">
          <div class="flex items-center justify-between p-4 border-b border-surface-200">
            <div class="flex items-center gap-2">
              <component :is="isEditMode ? PencilSquareIcon : EyeIcon" class="w-5 h-5 text-primary-500" />
              <h3 class="font-semibold text-surface-900">{{ isEditMode ? 'Editar Artículo' : 'Ver Artículo' }}</h3>
            </div>
            <div class="flex items-center gap-2">
              <button
                v-if="!isEditMode"
                @click="isEditMode = true"
                class="text-xs px-3 py-1.5 bg-primary-50 text-primary-600 hover:bg-primary-100 rounded-lg flex items-center gap-1 transition-colors"
              >
                <PencilSquareIcon class="w-3.5 h-3.5" /> Editar
              </button>
              <button @click="showArticleModal = false"><XMarkIcon class="w-5 h-5 text-surface-500" /></button>
            </div>
          </div>
          <div class="p-4 space-y-4 overflow-y-auto flex-1">
            <!-- Title -->
            <div>
              <label class="block text-sm font-medium text-surface-700 mb-1">Título</label>
              <input
                v-if="isEditMode"
                v-model="articleEditForm.title"
                class="input w-full"
                placeholder="Título del artículo"
              />
              <p v-else class="text-surface-900 font-medium">{{ articleEditForm.title }}</p>
            </div>
            <!-- Content -->
            <div>
              <label class="block text-sm font-medium text-surface-700 mb-1">Contenido</label>
              <textarea
                v-if="isEditMode"
                v-model="articleEditForm.content"
                class="input w-full"
                rows="14"
                placeholder="Contenido del artículo..."
              ></textarea>
              <div v-else class="bg-surface-50 rounded-lg p-4 max-h-[50vh] overflow-y-auto">
                <pre class="text-sm text-surface-700 whitespace-pre-wrap font-sans">{{ articleEditForm.content }}</pre>
              </div>
            </div>
            <!-- Metadata -->
            <div v-if="editingArticle" class="flex items-center gap-4 text-[10px] text-surface-400 pt-2 border-t border-surface-100">
              <span>Tipo: {{ editingArticle.sourceType === 'pdf' ? 'PDF' : 'Texto' }}</span>
              <span>Chunks: {{ editingArticle.chunkCount || 0 }}</span>
              <span>Creado: {{ formatDate(editingArticle.createdAt) }}</span>
              <span v-if="editingArticle.isProcessed" class="text-green-500">✓ Procesado</span>
              <span v-else class="text-amber-500">⏳ Procesando...</span>
            </div>
          </div>
          <div v-if="isEditMode" class="flex gap-3 p-4 border-t border-surface-200">
            <button type="button" @click="isEditMode = false" class="btn-secondary flex-1">Cancelar</button>
            <button @click="saveArticle" class="btn-primary flex-1" :disabled="savingArticle">
              {{ savingArticle ? 'Guardando...' : 'Guardar y reprocesar' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- PDF Upload Modal -->
    <Teleport to="body">
      <div v-if="showPdfUpload" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" @click.self="showPdfUpload = false">
        <div class="bg-white rounded-xl shadow-2xl max-w-md w-full">
          <div class="flex items-center justify-between p-4 border-b border-surface-200">
            <h3 class="font-semibold text-surface-900">Subir PDF</h3>
            <button @click="showPdfUpload = false"><XMarkIcon class="w-5 h-5 text-surface-500" /></button>
          </div>
          <form @submit.prevent="uploadPdf" class="p-4 space-y-4">
            <div>
              <label class="block text-sm font-medium text-surface-700 mb-1">Título</label>
              <input v-model="pdfTitle" class="input w-full" placeholder="Nombre del documento" />
            </div>
            <div>
              <label class="block text-sm font-medium text-surface-700 mb-1">Archivo PDF</label>
              <input type="file" accept=".pdf" @change="handleFileChange" class="input w-full" />
            </div>
            <div class="flex gap-3">
              <button type="button" @click="showPdfUpload = false" class="btn-secondary flex-1">Cancelar</button>
              <button type="submit" class="btn-primary flex-1" :disabled="!pdfFile || uploading">
                {{ uploading ? 'Procesando...' : 'Subir y procesar' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>
