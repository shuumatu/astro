<script setup lang="ts">
import Vditor from 'vditor'
import 'vditor/dist/index.css'
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: string
  placeholder?: string
  interfaceLanguage?: string
}>(), { placeholder: '', interfaceLanguage: 'zh-CN' })

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const editorElement = ref<HTMLElement | null>(null)
let editor: Vditor | null = null
let syncing = false

onMounted(async () => {
  await nextTick()
  if (!editorElement.value) return
  editor = new Vditor(editorElement.value, {
    cdn: `${window.location.origin}/vditor-assets`,
    mode: 'ir',
    lang: props.interfaceLanguage === 'en' ? 'en_US' : 'zh_CN',
    value: props.modelValue,
    placeholder: props.placeholder,
    height: 520,
    cache: { enable: false },
    counter: { enable: true, max: 100000 },
    toolbar: [
      { name: 'heading-2', tip: 'Heading 2', prefix: '## ', icon: '<span class="vditor-heading-icon">H2</span>' },
      { name: 'heading-3', tip: 'Heading 3', prefix: '### ', icon: '<span class="vditor-heading-icon">H3</span>' },
      '|', 'bold', 'italic', 'strike', '|',
      'list', 'ordered-list', 'check', 'quote', 'line', '|',
      'code', 'inline-code', 'link', 'table', '|',
      'undo', 'redo', 'edit-mode', 'fullscreen', 'outline',
    ],
    preview: { mode: 'both', hljs: { enable: true } },
    outline: { enable: true, position: 'left' },
    input: value => {
      if (syncing) return
      emit('update:modelValue', value)
    },
  })
})

watch(() => props.modelValue, value => {
  if (!editor || editor.getValue() === value) return
  syncing = true
  editor.setValue(value)
  syncing = false
})

onBeforeUnmount(() => {
  editor?.destroy()
  editor = null
})

function insertMarkdown(markdown: string): void {
  editor?.focus()
  editor?.insertMD(markdown)
}

defineExpose({ insertMarkdown })
</script>

<template>
  <div ref="editorElement" class="explore-markdown-editor" />
</template>

<style scoped>
.explore-markdown-editor { min-width: 0; border: 1px solid #314954; color: #dce6e3; background: #08151c; }
.explore-markdown-editor :deep(.vditor) { border: 0; background: transparent; }
.explore-markdown-editor :deep(.vditor-toolbar) { border-bottom-color: #263f49; background: #0d2029; }
.explore-markdown-editor :deep(.vditor-toolbar__item) { color: #a9bdc0; }
.explore-markdown-editor :deep(.vditor-toolbar__item:hover),
.explore-markdown-editor :deep(.vditor-toolbar__item--current) { background: #1b3540; color: #f1d19e; }
.explore-markdown-editor :deep(.vditor-ir),
.explore-markdown-editor :deep(.vditor-wysiwyg),
.explore-markdown-editor :deep(.vditor-sv) { color: #dce6e3; background: #08151c; }
.explore-markdown-editor :deep(.vditor-reset) { font-size: 16px; line-height: 1.8; }
.explore-markdown-editor :deep(.vditor-ir h2) { margin-top: 1.3em; border-bottom: 1px solid #28434c; padding-bottom: .2em; color: #f0d19e; }
.explore-markdown-editor :deep(.vditor-ir h3) { color: #cce1dc; }
.explore-markdown-editor :deep(.vditor-counter) { color: #78919a; }
.explore-markdown-editor :deep(.vditor-heading-icon) { font-size: 11px; font-weight: 700; }
</style>
