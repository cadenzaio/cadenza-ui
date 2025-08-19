<template>
  <q-timeline layout="comfortable" style="max-width: 97%">
    <q-timeline-entry
      v-for="(entry, index) in itemMap"
      :key="index"
      :title="entry.label"
      :subtitle="formatDate(entry.started)"
      :side="entry.layer_index % 2 === 0 ? 'left' : 'right'"
      :style="{
        backgroundColor:
          entry.layer_index % 2 === 0 ? 'rgba(128, 128, 128, 0.1)' : '',
      }"
      @click="onTaskSelected(entry)"
    >
      <q-badge v-if="entry.description" color="primary">
        {{ getDescription(entry) }}
      </q-badge>
      <blockquote>
        <pre>{{ getContext(entry) }}</pre>
      </blockquote>
    </q-timeline-entry>
  </q-timeline>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface TimelineEntry {
  label: string;
  started: string;
  layer_index: number;
  description?: string;
  inputContext?: unknown;
  [key: string]: unknown;
}

const props = defineProps<{ itemMap: TimelineEntry[] }>();

function getDescription(entry: TimelineEntry): string | undefined {
  return entry.description;
}
function getContext(entry: TimelineEntry): string {
  return JSON.stringify(entry.inputContext, null, 2);
}

const formatDate = computed(() => (date: string) => {
  const formattedDate = new Date(date);
  return `${formattedDate.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })}`;
});

const emit = defineEmits<{
  (e: 'taskSelected', task: TimelineEntry): void;
}>();

function onTaskSelected(task: TimelineEntry) {
  emit('taskSelected', task);
  console.log('Task selected:', task);
}
</script>
