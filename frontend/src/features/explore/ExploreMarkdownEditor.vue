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
.explore-markdown-editor {
  --border-color: var(--color-border);
  --second-color: var(--color-text-subtle);
  --panel-background-color: var(--color-surface);
  --panel-shadow: 0 4px 18px var(--color-shadow);
  --toolbar-background-color: var(--color-surface-raised);
  --toolbar-icon-color: var(--color-text-muted);
  --toolbar-icon-hover-color: var(--color-blue);
  --textarea-background-color: var(--color-bg);
  --textarea-text-color: var(--color-text);
  --count-background-color: var(--color-surface-raised);
  --heading-border-color: var(--color-border);
  --blockquote-color: var(--color-text-muted);
  --callout-note-color: var(--color-blue);
  --callout-note-background-color: color-mix(in srgb, var(--color-blue) 10%, transparent);
  --callout-tip-color: var(--color-success);
  --callout-tip-background-color: color-mix(in srgb, var(--color-success) 10%, transparent);
  --callout-important-color: var(--color-lilac);
  --callout-important-background-color: color-mix(in srgb, var(--color-lilac) 10%, transparent);
  --callout-warning-color: var(--color-warning);
  --callout-warning-background-color: color-mix(in srgb, var(--color-warning) 10%, transparent);
  --callout-caution-color: var(--color-danger);
  --callout-caution-background-color: color-mix(in srgb, var(--color-danger) 10%, transparent);
  --ir-heading-color: var(--color-gold);
  --ir-title-color: var(--color-text-subtle);
  --ir-bi-color: var(--color-lilac);
  --ir-link-color: var(--color-blue);
  --ir-bracket-color: var(--color-text-subtle);
  --ir-paren-color: var(--color-text-muted);
  min-width: 0;
  border: 1px solid var(--color-border);
  color: var(--color-text);
  background: var(--color-bg);
}
.explore-markdown-editor :deep(.vditor) { border: 0; background: transparent; }
.explore-markdown-editor :deep(.vditor-toolbar) { border-bottom-color: var(--color-border); background: var(--color-surface-raised); }
.explore-markdown-editor :deep(.vditor-toolbar__item) { color: var(--color-text-muted); }
.explore-markdown-editor :deep(.vditor-toolbar__item:hover),
.explore-markdown-editor :deep(.vditor-toolbar__item--current) { background: var(--color-surface-raised); color: var(--color-gold); }
.explore-markdown-editor :deep(.vditor-ir),
.explore-markdown-editor :deep(.vditor-wysiwyg),
.explore-markdown-editor :deep(.vditor-sv) { color: var(--color-text); background: var(--color-bg); }
.explore-markdown-editor :deep(.vditor-reset) { color: var(--color-text); font-size: 16px; line-height: 1.8; }
.explore-markdown-editor :deep(.vditor-reset--error) { color: var(--color-danger); }
.explore-markdown-editor :deep(.vditor-reset a) { color: var(--color-blue); }
.explore-markdown-editor :deep(.vditor-reset hr) { background: var(--color-border); }
.explore-markdown-editor :deep(.vditor-reset blockquote) { color: var(--color-text-muted); border-color: var(--color-border); }
.explore-markdown-editor :deep(.vditor-reset table tr) { border-color: var(--color-border); background: var(--color-bg); }
.explore-markdown-editor :deep(.vditor-reset table tbody tr:nth-child(2n)) { background: var(--color-surface); }
.explore-markdown-editor :deep(.vditor-reset table td),
.explore-markdown-editor :deep(.vditor-reset table th) { border-color: var(--color-border); }
.explore-markdown-editor :deep(.vditor-ir h2) { margin-top: 1.3em; border-bottom: 1px solid var(--color-border); padding-bottom: .2em; color: var(--color-gold); }
.explore-markdown-editor :deep(.vditor-ir h3) { color: var(--color-text); }
.explore-markdown-editor :deep(.vditor-counter) { color: var(--color-text-subtle); }
.explore-markdown-editor :deep(.vditor-heading-icon) { font-size: 11px; font-weight: 700; }
.explore-markdown-editor { border-radius: 12px; }
.explore-markdown-editor:focus-within { border-color: var(--color-blue); }
.explore-markdown-editor :deep(.vditor-toolbar) { padding: 8px 10px; border-radius: 12px 12px 0 0; }
.explore-markdown-editor :deep(.vditor-toolbar__item:hover),
.explore-markdown-editor :deep(.vditor-toolbar__item--current) { color: var(--color-blue); }
</style>
