<script setup lang="ts">
import { ref } from 'vue'
import { useLearningProgress } from '../composables/useLearningProgress.ts'
const progress = useLearningProgress()
const input = ref<HTMLInputElement | null>(null)
const message = ref('')
const failed = ref(false)
const importing = ref(false)
async function restore(event: Event) {
  const field = event.target as HTMLInputElement
  const file = field.files?.[0]
  if (!file) return
  importing.value = true
  try {
    const result = await progress.importBackup(file)
    failed.value = false
    message.value = `Imported ${result.added} new completion marks.${result.ignored ? ` Skipped ${result.ignored} entries for unavailable lessons or courses.` : ''} Existing completion marks are kept.`
  } catch (error) {
    failed.value = true
    message.value = error instanceof SyntaxError ? 'This is not a valid JSON progress backup. Your progress has not changed.' : `${error instanceof Error ? error.message : 'Could not import progress.'} Your progress has not changed.`
  } finally { importing.value = false; field.value = '' }
}
</script>

<template>
  <div class="progress-backup">
    <p>Saved in this browser. Export a backup to keep your progress or move it to another device.</p>
    <div class="progress-backup-actions">
      <button :disabled="!progress.ready.value" @click="progress.exportBackup">Export progress</button>
      <button :disabled="!progress.ready.value || importing" @click="input?.click()">{{ importing ? 'Importing…' : 'Import backup' }}</button>
      <input ref="input" type="file" accept=".json,application/json" aria-label="Choose a progress backup" hidden @change="restore">
    </div>
    <p v-if="message" class="progress-import-message" :class="{ 'has-error': failed }" role="status">{{ message }}</p>
  </div>
</template>
