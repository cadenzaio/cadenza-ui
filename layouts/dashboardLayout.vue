<template>
  <q-layout view="hHh LpR lFf" class="overflow-auto">
    <q-header elevated>
      <q-toolbar :class="['navContainer', toolbarClass, 'flex']" style="height: 100px;">
        <q-img src="/CadenzaLogo.png" class="logo" style="z-index: 500" />
        <div v-if="appStore.isLoggedIn" class="flex items-center">
          <q-tooltip
            v-if="showTooltip"
            anchor="top middle"
            self="bottom middle"
            :offset="[0, 10]"
          >
            Right click to open in new tab
          </q-tooltip>
          <q-btn
            flat
            to="/"
            @click="setSection('home')"
            @contextmenu.prevent="openLinkInNewTab('/')"
            @mouseover="showTooltip = true"
            @mouseleave="showTooltip = false"
          >
            Home
          </q-btn>
          <q-btn
            flat
            to="/system"
            @click="() => setSection('system')"
            @contextmenu.prevent="openLinkInNewTab('/system')"
            @mouseover="showTooltip = true"
            @mouseleave="showTooltip = false"
          >
            System
          </q-btn>
          <q-btn
            flat
            to="/activity"
            @click="() => setSection('serviceActivity')"
            @contextmenu.prevent="openLinkInNewTab('/activity')"
            @mouseover="showTooltip = true"
            @mouseleave="showTooltip = false"
          >
            Service Activity
          </q-btn>
        </div>

        <div class="flex items-center ml-auto absolute-right q-pt-xs q-pr-md">
          <!-- <User /> -->
          <ThemeToggleButton />
        </div>
      </q-toolbar>
    </q-header>
    <q-drawer
      v-if="appStore.isLoggedIn"
      class="q-pa-lg drawer-container"
      v-model="drawerOpen"
      :mini="miniState"
      :mini-to-overlay="false"
      behavior="default"
      :breakpoint="0"
      side="left"
      elevated
      :style="{ background: toolbarClassLight }"
    >
      <div
        class="q-mini-drawer-show absolute"
        style="top: 50%; transform: translateY(-50%); right: 0"
      >
        <q-btn
          dense
          square
          unelevated
          color="grey-9"
          :icon="miniState ? 'chevron_right' : 'chevron_left'"
          @click="toggleDrawer"
        />
      </div>
      <div class="drawer-content">
        <q-expansion-item
          expand-separator
          label="system"
          header-class="text-primary"
          v-model="showsystem"
          to="/system"
          hide-expand-icon
          @click="() => setSection('system', true)"
          @contextmenu.prevent="openLinkInNewTab('/system')"
        >
          <template #header>
            <div
              style="width: 100%"
              @contextmenu.prevent="openLinkInNewTab('/system')"
              @mouseover="showTooltip = true"
              @mouseleave="showTooltip = false"
            >
              <q-tooltip
                anchor="top middle"
                self="bottom middle"
                :offset="[0, 10]"
                >Right click to open in new tab</q-tooltip
              >
              <span class="text-primary">System</span>
            </div>
          </template>
          <q-item>
            <q-btn
              flat
              color="primary"
              to="/system/services"
              @click="() => setSection('system', true)"
            >
              <q-tooltip
                anchor="top middle"
                self="bottom middle"
                :offset="[0, 10]"
                >Right click to open in new tab</q-tooltip
              >
              <span
                @contextmenu.prevent="openLinkInNewTab('/system/services')"
                @mouseover="showTooltip = true"
                @mouseleave="showTooltip = false"
                >Services</span
              >
            </q-btn>
          </q-item>
          <q-item>
            <q-btn
              flat
              color="primary"
              to="/system/routines"
              @click="() => setSection('system', true)"
            >
              <q-tooltip
                anchor="top middle"
                self="bottom middle"
                :offset="[0, 10]"
                >Right click to open in new tab</q-tooltip
              >
              <span
                @contextmenu.prevent="openLinkInNewTab('/system/routines')"
                @mouseover="showTooltip = true"
                @mouseleave="showTooltip = false"
                >Routines</span
              >
            </q-btn>
          </q-item>
          <q-item>
            <q-btn
              flat
              color="primary"
              to="/system/tasks"
              @click="() => setSection('system', true)"
            >
              <q-tooltip
                anchor="top middle"
                self="bottom middle"
                :offset="[0, 10]"
                >Right click to open in new tab</q-tooltip
              >
              <span
                @contextmenu.prevent="openLinkInNewTab('/system/tasks')"
                @mouseover="showTooltip = true"
                @mouseleave="showTooltip = false"
                >Tasks</span
              >
            </q-btn>
          </q-item>
          <q-item>
            <q-btn
              flat
              color="primary"
              to="/system/signals"
              @click="() => setSection('system', true)"
            >
              <q-tooltip
                anchor="top middle"
                self="bottom middle"
                :offset="[0, 10]"
                >Right click to open in new tab</q-tooltip
              >
              <span
                @contextmenu.prevent="openLinkInNewTab('/system/signals')"
                @mouseover="showTooltip = true"
                @mouseleave="showTooltip = false"
                >Signals</span
              >
            </q-btn>
          </q-item>
        </q-expansion-item>
        <q-expansion-item
          expand-separator
          label="Service Activity"
          header-class="text-warning"
          v-model="showserviceActivity"
          to="/activity"
          hide-expand-icon
          @click="() => setSection('serviceActivity', true)"
          @contextmenu.prevent="openLinkInNewTab('/activity')"
        >
          <template #header>
            <div
              style="width: 100%"
              @contextmenu.prevent="openLinkInNewTab('/activity')"
              @mouseover="showTooltip = true"
              @mouseleave="showTooltip = false"
            >
              <q-tooltip
                anchor="top middle"
                self="bottom middle"
                :offset="[0, 10]"
                >Right click to open in new tab</q-tooltip
              >
              <span class="text-warning">Service Activity</span>
            </div>
          </template>
          <q-item>
            <q-btn
              flat
              color="warning"
              to="/activity/traces"
              @click="() => setSection('serviceActivity', true)"
            >
              <q-tooltip
                anchor="top middle"
                self="bottom middle"
                :offset="[0, 10]"
                >Right click to open in new tab</q-tooltip
              >
              <span
                @contextmenu.prevent="openLinkInNewTab('/activity/traces')"
                @mouseover="showTooltip = true"
                @mouseleave="showTooltip = false"
                >Traces</span
              >
            </q-btn>
          </q-item>
          <q-item>
            <q-btn
              flat
              color="warning"
              to="/activity/routines"
              @click="() => setSection('serviceActivity', true)"
            >
              <q-tooltip
                anchor="top middle"
                self="bottom middle"
                :offset="[0, 10]"
                >Right click to open in new tab</q-tooltip
              >
              <span
                @contextmenu.prevent="openLinkInNewTab('/activity/routines')"
                @mouseover="showTooltip = true"
                @mouseleave="showTooltip = false"
                >Routines</span
              >
            </q-btn>
          </q-item>
          <q-item>
            <q-btn
              flat
              color="warning"
              to="/activity/tasks"
              @click="() => setSection('serviceActivity', true)"
            >
              <q-tooltip
                anchor="top middle"
                self="bottom middle"
                :offset="[0, 10]"
                >Right click to open in new tab</q-tooltip
              >
              <span
                @contextmenu.prevent="openLinkInNewTab('/activity/tasks')"
                @mouseover="showTooltip = true"
                @mouseleave="showTooltip = false"
                >Tasks</span
              >
            </q-btn>
          </q-item>
          <q-item>
            <q-btn
              flat
              color="warning"
              to="/activity/signals"
              @click="() => setSection('serviceActivity', true)"
            >
              <q-tooltip
                anchor="top middle"
                self="bottom middle"
                :offset="[0, 10]"
                >Right click to open in new tab</q-tooltip
              >
              <span
                @contextmenu.prevent="openLinkInNewTab('/activity/signals')"
                @mouseover="showTooltip = true"
                @mouseleave="showTooltip = false"
                >Signals</span
              >
            </q-btn>
          </q-item>
        </q-expansion-item>
        <q-expansion-item
          expand-separator
          label="Meta"
          header-class="text-accent"
          v-model="showMeta"
          to="/meta"
          hide-expand-icon
          @click="() => setSection('meta', true)"
          @contextmenu.prevent="openLinkInNewTab('/meta')"
        >
          <template #header>
            <div
              style="width: 100%"
              @contextmenu.prevent="openLinkInNewTab('/meta')"
              @mouseover="showTooltip = true"
              @mouseleave="showTooltip = false"
            >
              <q-tooltip
                anchor="top middle"
                self="bottom middle"
                :offset="[0, 10]"
                >Right click to open in new tab</q-tooltip
              >
              <span class="text-accent">Meta</span>
            </div>
          </template>
          <q-item>
            <q-btn
              flat
              color="accent"
              to="/meta/routines"
              @click="() => setSection('meta', true)"
            >
              <q-tooltip
                anchor="top middle"
                self="bottom middle"
                :offset="[0, 10]"
                >Right click to open in new tab</q-tooltip
              >
              <span
                @contextmenu.prevent="openLinkInNewTab('/meta/routines')"
                @mouseover="showTooltip = true"
                @mouseleave="showTooltip = false"
                >Routines</span
              >
            </q-btn>
          </q-item>
          <q-item>
            <q-btn
              flat
              color="accent"
              to="/meta/tasks"
              @click="() => setSection('meta', true)"
            >
              <q-tooltip
                anchor="top middle"
                self="bottom middle"
                :offset="[0, 10]"
                >Right click to open in new tab</q-tooltip
              >
              <span
                @contextmenu.prevent="openLinkInNewTab('/meta/tasks')"
                @mouseover="showTooltip = true"
                @mouseleave="showTooltip = false"
                >Tasks</span
              >
            </q-btn>
          </q-item>
          <q-item>
            <q-btn
              flat
              color="accent"
              to="/meta/signals"
              @click="() => setSection('meta', true)"
            >
              <q-tooltip
                anchor="top middle"
                self="bottom middle"
                :offset="[0, 10]"
                >Right click to open in new tab</q-tooltip
              >
              <span
                @contextmenu.prevent="openLinkInNewTab('/meta/signals')"
                @mouseover="showTooltip = true"
                @mouseleave="showTooltip = false"
                >Signals</span
              >
            </q-btn>
          </q-item>
        </q-expansion-item>
      </div>
      <div class="drawer-footer q-pa-md">
        <q-expansion-item
          expand-separator
          label="Help"
          header-class="text-grey-8"
          v-model="showHelp"
          to="/help"
          hide-expand-icon
          @click="() => setSection('help', true)"
          @mouseenter="showHelp = true"
          @mouseleave="showHelp = false"
          @contextmenu.prevent="openLinkInNewTab('/help')"
        >
          <template #header>
            <div
              style="width: 100%"
              @contextmenu.prevent="openLinkInNewTab('/help')"
              @mouseover="showTooltip = true"
              @mouseleave="showTooltip = false"
            >
              <q-tooltip
                anchor="top middle"
                self="bottom middle"
                :offset="[0, 10]"
                >Right click to open in new tab</q-tooltip
              >
              <span class="text-grey-8">Help</span>
            </div>
          </template>
          <q-item>
            <q-btn
              flat
              color="grey-8"
              to="/help/processingGraph"
              @click="() => setSection('help', true)"
              class="left-no-wrap-btn"
            >
              <q-tooltip
                anchor="top middle"
                self="bottom middle"
                :offset="[0, 10]"
                >Right click to open in new tab</q-tooltip
              >
              <span
                @contextmenu.prevent="openLinkInNewTab('/help/processingGraph')"
                @mouseover="showTooltip = true"
                @mouseleave="showTooltip = false"
                >Processing Graph</span
              >
            </q-btn>
          </q-item>
          <q-item>
            <q-btn
              flat
              color="grey-8"
              to="/help/terms"
              @click="() => setSection('help', true)"
            >
              <q-tooltip
                anchor="top middle"
                self="bottom middle"
                :offset="[0, 10]"
                >Right click to open in new tab</q-tooltip
              >
              <span
                @contextmenu.prevent="openLinkInNewTab('/help/terms')"
                @mouseover="showTooltip = true"
                @mouseleave="showTooltip = false"
                >UI</span
              >
            </q-btn>
          </q-item>
          <q-item>
            <q-btn
              flat
              color="grey-8"
              to="/help/faq"
              @click="() => setSection('help', true)"
            >
              <q-tooltip
                anchor="top middle"
                self="bottom middle"
                :offset="[0, 10]"
                >Right click to open in new tab</q-tooltip
              >
              <span
                @contextmenu.prevent="openLinkInNewTab('/help/faq')"
                @mouseover="showTooltip = true"
                @mouseleave="showTooltip = false"
                >FAQ</span
              >
            </q-btn>
          </q-item>
        </q-expansion-item>
      </div>
    </q-drawer>
    <div :class="['polka-container', polkaClass]">
      <q-page-container :class="['window-width', 'window-height', 'content']">
        <slot />
      </q-page-container>
    </div>
  </q-layout>
</template>

<script setup>
import { useRouter } from 'vue-router';
const showTooltip = ref(false);
const router = process.client ? useRouter() : null;

import { useOpenLinkInNewTab } from '~/composables/useOpenLinkInNewTab';
const { openLinkInNewTab } = useOpenLinkInNewTab();
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { colors, useQuasar } from 'quasar';
import { storeToRefs } from 'pinia';
import { useAppStore } from '~/stores/app';
import ThemeToggleButton from '~/components/ThemeToggleButton.vue';

const showsystem = ref(true);
const showserviceActivity = ref(true);
const showMeta = ref(true);
const showHelp = ref(false);
const drawerOpen = ref(true);
const miniState = ref(false);
const appStore = useAppStore();
const { currentSection } = storeToRefs(appStore);

let $q;
if (process.client) {
  $q = useQuasar();
}

const setSection = (section, disableMini = false) => {
  appStore.setCurrentSection(section);
  // showTraces.value = section === 'Traces';
  // showsystem.value = section === 'system';
  // showserviceActivity.value = section === 'serviceActivity';
  if (disableMini) {
    miniState.value = false;
  }
};

const toggleDrawer = () => {
  miniState.value = !miniState.value;
};

const handleResize = () => {
  if (window.innerWidth < 1024) {
    miniState.value = true;
  } else {
    miniState.value = false;
  }
};

const toolbarClass = computed(() => {
  switch (currentSection.value) {
    case 'system':
      return 'bg-primary';
    case 'serviceActivity':
      return 'bg-warning';
    case 'Traces':
      return 'bg-secondary';
    case 'meta':
      return 'bg-accent';
    case 'help':
      return 'bg-grey-8';
    default:
      return 'bg-secondary';
  }
});

const toolbarClassLight = computed(() => {
  switch (currentSection.value) {
    case 'system':
      return colors.changeAlpha(colors.getPaletteColor('primary'), 0.1);
    case 'serviceActivity':
      return colors.changeAlpha(colors.getPaletteColor('warning'), 0.1);
    case 'Traces':
      return colors.changeAlpha(colors.getPaletteColor('secondary'), 0.1);
    case 'meta':
      return colors.changeAlpha(colors.getPaletteColor('accent'), 0.1);
    case 'help':
      return colors.changeAlpha(colors.getPaletteColor('grey-8'), 0.1);
    default:
      return colors.changeAlpha(colors.getPaletteColor('secondary'), 0.1);
  }
});

const polkaClass = computed(() => {
  return $q && $q.dark.isActive ? 'polka-dark' : 'polka-light';
});

watch(
  currentSection,
  (newSection) => {
    setSection(newSection || 'home');
  },
  { immediate: true }
);

onMounted(() => {
  window.addEventListener('resize', handleResize);
  handleResize();
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
});
</script>

<style>
.polka-container {
  background-attachment: fixed;
  background-position: center;
  height: 100vh;
  width: 100%;
  position: relative;
  overflow: hidden;
}

.content {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow-y: auto;
}
.polka-light {
  background-image: radial-gradient(rgb(168, 167, 167) 5%, transparent 5%);
  background-position: 4px 4px;
  background-size: 19px 19px;
  background-color: rgb(255, 255, 255);
}

.polka-dark {
  background-image: radial-gradient(rgb(87, 87, 87) 5%, transparent 5%);
  background-position: 4px 4px;
  background-size: 19px 19px;
  background-color: rgb(0, 0, 0);
}

.window-width {
  width: 100vw;
}

.window-height {
  min-height: 100vh;
  position: relative;
}

.left-no-wrap-btn {
  white-space: nowrap;
  justify-content: flex-start !important;
  width: 100%;
  text-align: left;
  display: flex;
  align-items: center;
}

.drawer-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  width: 100%;
}

.drawer-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
  width: 100%;
}

.drawer-footer {
  flex-shrink: 0;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  overflow-x: hidden;
  width: 100%;
}

.fixed-bottom-left {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: inherit;
  z-index: 1;
}

.navContainer::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    100deg,
    rgba(0, 0, 0, 0.082) 0%,
    rgba(255, 255, 255, 0) 100%
  );
  pointer-events: none;
  z-index: 1;
}

.logo {
  width: 5dvh;

}
</style>
