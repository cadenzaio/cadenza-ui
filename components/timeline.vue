<template>
  <q-timeline layout='comfortable' style = "max-width:97%">
    <q-timeline-entry
      v-for="(entry, index) in itemMap"
      :key="index"
      :title="entry.label"
      :subtitle="formatDate(entry.started)"
      :side="entry.layer_index % 2 === 0 ? 'left' : 'right'"
      :style="{ backgroundColor: entry.layer_index % 2 === 0 ? 'rgba(128, 128, 128, 0.1)' : '' }"
      @click="onTaskSelected(entry)"
      >
      <q-badge v-if="entry.description" color="primary">
        {{ getDescription(entry)}}
      </q-badge>
      <blockquote>
        <pre>{{ getContext(entry) }}</pre>
      </blockquote>
    </q-timeline-entry>
  </q-timeline>
</template>

<script setup>
import { computed } from 'vue'

defineProps({
  itemMap: {
    type:Object,
    required: true
  }
})

function getDescription(entry) {
  return entry.description
}
function getContext(entry) {
  return JSON.stringify(entry.inputContext,null,2)
}

const formatDate = computed(() => (date) => {
  const formattedDate = new Date(date)
  return `${formattedDate.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })}`
})

const emit = defineEmits(['taskSelected'])

function onTaskSelected(task) {
  emit('taskSelected', task)
  console.log('Task selected:', task)
}
</script>
