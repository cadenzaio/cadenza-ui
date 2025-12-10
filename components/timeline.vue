<template>
  <q-timeline layout="comfortable" style="max-width: 97%">
    <q-timeline-entry
      v-for="(entry, index) in dedupedItems"
      :key="String(entry.uuid ?? index)"
      :title="entry.label"
      :subtitle="formatDate(entry.started)"
      :side="entry.layer_index % 2 === 0 ? 'left' : 'right'"
      :style="{
        backgroundColor:
          entry.timelineType === 'heading'
            ? 'rgba(0, 123, 255, 0.10)'
            : entry.layer_index % 2 === 0
            ? 'rgba(128, 128, 128, 0.1)'
            : '',
        borderLeft: entry.timelineType === 'heading' ? '4px solid #007bff' : '',
        fontWeight: entry.timelineType === 'heading' ? 'bold' : 'normal',
      }"
      @click="onTaskSelected(entry)"
    >
      <q-badge v-if="entry.type" color="blue-8" class="q-mb-sm">
        {{ String(entry.type).charAt(0).toUpperCase() + String(entry.type).slice(1) }}
      </q-badge>
      <q-badge
        v-else-if="entry.timelineType === 'heading'"
        color="blue-8"
        class="q-mb-sm"
      >
        {{ entry.nodeType === 'service' ? 'Service' : 'Routine' }}
      </q-badge>
      <q-badge v-else-if="entry.description" color="primary">
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

const dedupedItems = computed(() => {
  const items = props.itemMap || [];
  const seen = new Set<string>();
  const out: TimelineEntry[] = [];
  for (const it of items) {
    const id = (it && (it.uuid as string)) || (it && (it.id as string)) || null;
    if (!id) continue;
    if (!seen.has(id)) {
      seen.add(id);
      out.push(it as TimelineEntry);
    }
  }
  const parseTs = (it: TimelineEntry) => {
    const s = (it && ((it.started as unknown) || (it.created as unknown))) as string | undefined | null;
    if (!s) return Number.POSITIVE_INFINITY;
    const t = Date.parse(s);
    return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY;
  };

  out.sort((a, b) => parseTs(a) - parseTs(b));
  return out;
});

function getDescription(entry: TimelineEntry): string | undefined {
  return entry.description;
}
function getContext(entry: TimelineEntry): string {
  return JSON.stringify(entry.inputContext, null, 2);
}

const formatDate = computed(() => (date: string) => {
  if (!date) return '';
  const formattedDate = new Date(date);
  if (isNaN(formattedDate.getTime())) return '';
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
