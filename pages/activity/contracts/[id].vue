<template>
  <NuxtLayout name="dashboard-layout">
    <NuxtLayout name="dashboard-main-layout">
      <template #title>
        Contract Elements
        <q-btn color="primary" @click="showGenerateDialog = true"
          >Regenerate Contract</q-btn
        >
      </template>
      <div>
        <div class="q-pa-md">
          <q-tabs
            v-model="selectedOption"
            dense
            class="text-grey-9 bg-transparent"
            active-color="primary"
            indicator-color="primary"
            align="justify"
            narrow-indicator
          >
            <q-tab name="routineMap" label="Map" />
            <q-tab name="timeline" label="Timeline" />
            <q-tab name="rangedTimeline" label="Ranged Timeline" />
          </q-tabs>

          <q-separator />

          <transition
            name="fade"
            mode="out-in"
            :duration="{ enter: 500, leave: 300 }"
          >
            <div v-show="selectedOption === 'routineMap'">
              <flowMap :items="routineMap" @item-selected="onTaskSelected" />
            </div>
          </transition>
          <transition
            name="fade"
            mode="out-in"
            :duration="{ enter: 500, leave: 300 }"
          >
            <div v-show="selectedOption === 'timeline'">
              <Timeline :itemMap="routineMap" />
            </div>
          </transition>
          <transition
            name="fade"
            mode="out-in"
            :duration="{ enter: 500, leave: 300 }"
          >
            <div v-show="selectedOption === 'rangedTimeline'">
              <ApexTimeline :itemMap="routineMap" />
            </div>
          </transition>
        </div>
      </div>
      <div>
        <div>
          <div class="justify-around flex w-full gap-4">
            <InfoCard>
              <template #title>
                {{ contractContext?.product || 'Contract Info' }}
              </template>
              <template #info>
                <div class="flex-column full-width">
                  <div class="q-mx-md q-my-sm">
                    Issued at:
                    {{
                      contractContext?.issued_at
                        ? formatDate(contractContext.issued_at)
                        : ''
                    }}
                  </div>
                  <div class="q-mx-md q-my-sm">
                    Fulfilled:
                    <span
                      :class="
                        contractContext?.fulfilled
                          ? 'text-positive'
                          : 'text-negative'
                      "
                    >
                      {{ contractContext?.fulfilled ? 'Yes' : 'No' }}
                    </span>
                  </div>
                  <div class="q-mx-md q-my-sm">
                    Fulfilled at:
                    {{
                      contractContext?.fulfilled_at
                        ? formatDate(contractContext.fulfilled_at)
                        : ''
                    }}
                  </div>
                  <div class="q-mx-md q-my-sm">
                    Description: {{ contractContext?.description }}
                  </div>
                  <div class="q-mx-md q-my-sm">
                    Contract UUID: {{ contractContext?.uuid }}
                  </div>
                </div>
              </template>
            </InfoCard>
            <div>
              <InfoCard>
                <template #title>Input Context</template>
                <template #info>
                  <div class="q-mx-md q-my-sm">
                    <pre>{{ contractContext?.input_context }}</pre>
                  </div>
                </template>
              </InfoCard>
              <InfoCard>
                <template #title>Output Context</template>
                <template #info>
                  <div class="q-mx-md q-my-sm">
                    <pre>{{ contractContext?.output_context }}</pre>
                  </div>
                </template>
              </InfoCard>
            </div>
          </div>
        </div>
        <div class="row q-mx-md">
          <Table
            class="custom-table"
            :columns="columns"
            :rows="routines"
            row-key="uuid"
            @inspect-row="inspectRoutine"
            @inspect-row-in-new-tab="inspectInNewTab"
            @loadMoreData="loadMoreRoutines"
            :enableInfiniteScroll="true"
            :hasMoreData="hasMoreData"
            :loadingMoreData="loadingMoreData"
          >
            <template #title>
              Active Executions ({{ routines.length }} found)
            </template>
          </Table>
          <div v-if="isLoading" class="q-pa-md text-center">
            Loading active executions...
          </div>
          <div v-else-if="error" class="q-pa-md text-center text-negative">
            Error: {{ error }}
          </div>
          <div
            v-else-if="routines.length === 0"
            class="q-pa-md text-center text-grey-6"
          >
            No active executions found for this contract.
          </div>
        </div>
        <!-- <ContractHeatMap :contractId="String(route.params.id)"/> -->
      </div>
      <q-dialog v-model="showGenerateDialog">
        <q-card>
          <q-card-section>
            <div class="text-h6">Confirm Generate</div>
            <div>Are you sure you want to generate a contract?</div>
          </q-card-section>
          <q-card-actions align="right">
            <q-btn
              flat
              label="Cancel"
              color="primary"
              @click="showGenerateDialog = false"
            />
            <q-btn
              flat
              label="Confirm"
              color="secondary"
              @click="confirmGenerate"
            />
          </q-card-actions>
        </q-card>
      </q-dialog>
    </NuxtLayout>
  </NuxtLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useFetch, useRoute } from '#app';
import { useRouter } from '#vue-router';
// import ContractHeatMap from '~/components/ContractHeatMap.vue';
// import ApexTimeline from '~/components/ApexTimeline.vue';

function formatDate(date: string) {
  const datetime = new Date(date);
  return `${datetime.toDateString()} ${datetime.toLocaleTimeString()}`;
}

const showGenerateDialog = ref(false);
const contractContext = ref<any>(null);
const routines = ref<any[]>([]);
const isLoading = ref(false);
const error = ref<string | null>(null);
const hasMoreData = ref(true);
const loadingMoreData = ref(false);
const currentPage = ref(1);
const pageSize = 50;
const router = useRouter();
const route = useRoute();
const selectedOption = ref('routineMap');
const routineMap = ref([]);

const columns = [
  {
    name: 'label',
    label: 'Name',
    field: 'label',
    required: true,
    sortable: true,
  },
  {
    name: 'description',
    label: 'Description',
    field: 'description',
    required: true,
    sortable: false,
  },
  {
    name: 'status',
    label: 'Status',
    field: 'status',
    required: true,
    sortable: true,
  },
  {
    name: 'progress',
    label: 'Progress',
    field: 'progress',
    required: true,
    sortable: false,
  },
  {
    name: 'started',
    label: 'Started',
    field: 'started',
    required: true,
    sortable: true,
  },
  {
    name: 'ended',
    label: 'Ended',
    field: 'ended',
    required: true,
    sortable: true,
  },
  {
    name: 'duration',
    label: 'Duration (sec)',
    field: 'duration',
    required: true,
    sortable: true,
  },
];

function inspectRoutine(routine: any) {
  router.push(`/activity/routines/${routine.uuid}`);
}

function inspectInNewTab(routine: any) {
  const url = `/activity/routines/${routine.uuid}`;
  window.open(url, '_blank');
}

async function loadRoutines(isLoadMore = false) {
  const contractId = route.params.id;

  try {
    if (isLoadMore) {
      loadingMoreData.value = true;
      currentPage.value++;
    }

    console.log(
      `Fetching routines for contractId: ${contractId}, page: ${currentPage.value}`
    );

    const routinesResponse = await fetch(
      `/api/activity/routines/activeRoutines?contractId=${contractId}&page=${currentPage.value}&limit=${pageSize}`
    );
    if (!routinesResponse.ok) {
      console.error(
        'Routines response not ok:',
        routinesResponse.status,
        routinesResponse.statusText
      );
      throw new Error(`Failed to fetch routines: ${routinesResponse.status}`);
    }
    const routinesData = await routinesResponse.json();
    console.log('Routines data received:', routinesData);

    if (isLoadMore) {
      routines.value = [...routines.value, ...(routinesData.routines || [])];
    } else {
      routines.value = routinesData.routines || [];
    }

    routineMap.value = routinesData.routineMap || [];
    hasMoreData.value = (routinesData.routines || []).length === pageSize;
  } catch (err) {
    console.error('Error loading routines:', err);
    hasMoreData.value = false;
  } finally {
    if (isLoadMore) {
      loadingMoreData.value = false;
    }
  }
}

async function loadMoreRoutines() {
  await loadRoutines(true);
}

function onTaskSelected(task: any) {
  // Handle task selection
}

function confirmGenerate() {
  showGenerateDialog.value = false;
  // Add logic to handle generating the contract
}

onMounted(async () => {
  const appStore = useAppStore();
  appStore.setCurrentSection('serviceActivity');
  const contractId = route.params.id;

  currentPage.value = 1; // Always start at page 1 on mount

  isLoading.value = true;
  error.value = null;

  try {
    // Load first page of routines
    await loadRoutines(false);

    // Fetch contract context from /api/contracts?uuid=...
    console.log('Fetching contract context for contractId:', contractId);
    const contractRes = await fetch(
      `/api/contracts/contracts?uuid=${contractId}`
    );
    if (contractRes.ok) {
      const contractData = await contractRes.json();
      console.log('Contract data received:', contractData);
      contractContext.value = contractData.contracts?.[0] || null;
    } else {
      console.error(
        'Contract response not ok:',
        contractRes.status,
        contractRes.statusText
      );
    }
  } catch (err) {
    console.error('Error in onMounted:', err);
    error.value =
      err instanceof Error ? err.message : 'An unknown error occurred';
  } finally {
    isLoading.value = false;
  }
});
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s;
}
.fade-enter,
.fade-leave-to {
  opacity: 0;
}
.custom-table {
  background-color: #e6b30dc4;
}
</style>
