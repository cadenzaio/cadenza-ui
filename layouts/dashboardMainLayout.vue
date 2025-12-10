<template>
  <div
    class="q-pa-none q-ma-xs-md"
    style="height: 100%; display: flex; flex-direction: column"
  >
    <div class="q-gutter-xs" style="display: flex">
      <div class="q-gutter-xs flex-grow-1" style="overflow: auto">
        <q-breadcrumbs
          separator="/"
          :style="{ backgroundColor: breadcrumbBg, borderRadius: '20px' }"
          class="q-py-xs q-px-md"
          :active-color="breadcrumbActiveColor"
        >
          <q-breadcrumbs-el :to="'/'" icon="home" class="homeIcon" />
          <q-breadcrumbs-el
            v-for="(breadcrumb, index) in breadcrumbs"
            :key="index"
            :to="breadcrumb.to"
            :label="breadcrumb.label"
            :color="breadcrumbActiveColor"
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
import { useAppStore } from '~/stores/app';
import { colors, useQuasar } from 'quasar';

const route = useRoute();
const appStore = useAppStore();
const currentSection = computed(() => appStore.currentSection);

let $q;
if (process.client) {
  $q = useQuasar();
}

const breadcrumbs = computed(() => {
  const pathArray = route.path.split('/').filter((segment) => segment);

  const items = [];
  for (let index = 0; index < pathArray.length; index++) {
    const segment = pathArray[index];
    const prev = index > 0 ? pathArray[index - 1] : null;

    if (
      segment === 'services' &&
      (prev === 'meta' || prev === 'activity' || prev === 'active')
    ) {
      continue;
    }

    const cleanSegment = decodeURIComponent(segment.replace('-sub', ''));
    const to =
      index === pathArray.length - 1
        ? null
        : '/' +
          pathArray
            .slice(0, index + 1)
            .join('/')
            .replace('-sub', '');

    items.push({
      label: formatBreadcrumbLabel(cleanSegment, index, pathArray),
      to,
    });
  }

  return items;
});

function formatBreadcrumbLabel(segment) {
  if (segment === 'system') return 'System';
  if (segment === 'active') return 'Service Activity';
  if (segment === 'activity') return 'Service Activity';
  if (segment === 'tasks') return 'Tasks';
  if (segment === 'routines') return 'Routines';
  if (segment === 'help') return 'Help';
  if (segment.startsWith('chapter')) {
    const match = segment.match(/^chapter(\d+)/);
    if (match) return `Chapter ${match[1]}`;
    return 'Chapter';
  }
  return segment.charAt(0).toLowerCase() + segment.slice(1).replace(/-/g, ' ');
}

const breadcrumbBg = computed(() => {
  switch (currentSection.value) {
    case 'system':
      return colors.changeAlpha(colors.getPaletteColor('primary'), 0.1);
    case 'serviceActivity':
      return colors.changeAlpha(colors.getPaletteColor('warning'), 0.1);
    case 'traces':
      return colors.changeAlpha(colors.getPaletteColor('secondary'), 0.1);
    case 'meta':
      return colors.changeAlpha(colors.getPaletteColor('accent'), 0.1);
    case 'help':
      return colors.changeAlpha(colors.getPaletteColor('grey-8'), 0.1);
    default:
      return colors.changeAlpha(colors.getPaletteColor('secondary'), 0.1);
  }
});

const breadcrumbActiveColor = computed(() => {
  switch (currentSection.value) {
    case 'system':
      return 'primary';
    case 'serviceActivity':
      return 'warning';
    case 'traces':
      return 'secondary';
    case 'meta':
      return 'accent';
    case 'help':
      return 'grey-8';
    default:
      return 'secondary';
  }
});
</script>

<style scoped>
.active-breadcrumb {
  font-weight: bold;
  text-decoration: underline;
}
.homeIcon {
  color: #259f93 !important;
}
</style>
