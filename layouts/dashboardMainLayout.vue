<template>
  <div
    class="q-pa-none q-ma-xs-md"
    style="height: 100%; display: flex; flex-direction: column"
  >
    <div class="q-gutter-xs" style="display: flex">
      <div class="q-gutter-xs flex-grow-1" style="overflow: auto">
        <q-breadcrumbs
          separator="/"
          class="text-orange transparent-background q-py-xs q-px-md"
          active-color="primary"
        >
          <q-breadcrumbs-el :to="'/'" icon="home" />
          <q-breadcrumbs-el
            v-for="(breadcrumb, index) in breadcrumbs"
            :key="index"
            :to="breadcrumb.to"
            :label="breadcrumb.label"
            :class="{ 'active-breadcrumb': index === breadcrumbs.length - 1 }"
          />
        </q-breadcrumbs>
      </div>
      <div>
        <slot name="link" />
      </div>
    </div>
    <div class="q-pa-md text-h4">
      <slot name="title" />
    </div>
    <div>
      <slot />
    </div>
    <HelpMorph />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();

const breadcrumbs = computed(() => {
  const pathArray = route.path.split('/').filter((segment) => segment);

  return pathArray.map((segment, index) => {
    const cleanSegment = decodeURIComponent(segment.replace('-sub', ''));
    return {
      label: formatBreadcrumbLabel(cleanSegment, index, pathArray),
      to:
        index === pathArray.length - 1
          ? null
          : '/' +
            pathArray
              .slice(0, index + 1)
              .join('/')
              .replace('-sub', ''),
    };
  });
});

function formatBreadcrumbLabel(segment) {
  if (segment === 'services') return 'Services';
  if (segment === 'active') return 'Service Activity';
  if (segment === 'activity') return 'Service Activity';
  if (segment === 'tasks') return 'Tasks';
  if (segment === 'routines') return 'Routines';
  if (segment === 'help') return 'Help';
  if (segment === 'processingGraph') return 'Processing Graph';
  if (segment.startsWith('chapter')) {
    const match = segment.match(/^chapter(\d+)/);
    if (match) return `Chapter ${match[1]}`;
    return 'Chapter';
  }
  return segment.charAt(0).toLowerCase() + segment.slice(1).replace(/-/g, ' ');
}
</script>

<style scoped>
.transparent-background {
  background-color: rgba(221, 240, 248, 0.425) !important;
  box-shadow: none !important;
  border-radius: 20px !important;
}
</style>
