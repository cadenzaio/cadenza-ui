<template>
  <InfoCard>
    <template v-slot:title>
      <slot name="title">{{ title }}</slot>
    </template>

    <template #info>
      <q-table
        class="my-sticky-last-column-table"
        style="min-height: 50dvh; min-width: 40dvw"
        :title="title"
        :columns="formattedColumns"
        :rows="filteredRows"
        :row-key="rowKey"
        flat
        :pagination="{ rowsPerPage: 0 }"
        hide-pagination
        :virtual-scroll="virtualScrollEnabled"
        :virtual-scroll-item-size="virtualScrollItemSize"
        :virtual-scroll-sticky-size-start="virtualScrollStickyStart"
        :virtual-scroll-sticky-size-end="virtualScrollStickyEnd"
        @virtual-scroll="onVirtualScroll"
      >
        <template v-slot:top-right>
          <div class="row q-gutter-sm">
            <q-select
              v-if="hasStatusColumn"
              v-model="selectedStatuses"
              :options="statusOptions"
              option-value="value"
              option-label="label"
              label="Filter by Status"
              multiple
              dense
              outlined
              hide-selected
              style="min-width: 200px"
              @update:model-value="updateStatusFilter"
            >
              <template v-slot:prepend>
                <q-icon name="filter_list" />
              </template>
              <template
                v-slot:option="{ itemProps, opt, selected, toggleOption }"
              >
                <q-item v-bind="itemProps">
                  <q-item-section side>
                    <q-checkbox
                      :model-value="selected"
                      @update:model-value="toggleOption"
                    />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>
                      <q-icon
                        size="sm"
                        :name="opt.icon"
                        :color="opt.color"
                        class="q-mr-sm"
                      />
                      {{ opt.label }}
                    </q-item-label>
                  </q-item-section>
                </q-item>
              </template>
            </q-select>

            <!-- Date Range Filter -->
            <div
              v-if="hasStartedColumn"
              class="row q-gutter-xs items-center date-range-filter"
            >
              <q-btn
                flat
                outlined
                icon="date_range"
                :label="dateRangeLabel"
                @click="showDateRangeDialog = true"
                style="min-width: 180px"
              />

              <q-btn
                v-if="startDate || endDate"
                dense
                flat
                round
                icon="clear"
                @click="clearDateFilter"
                size="sm"
              >
                <q-tooltip>Clear date filter</q-tooltip>
              </q-btn>
            </div>

            <q-input
              dense
              outlined
              debounce="300"
              v-model="filter"
              placeholder="Search"
            >
              <template v-slot:append>
                <q-icon name="search" />
              </template>
            </q-input>
          </div>
        </template>

        <template v-slot:header="props">
          <q-tr :props="props">
            <q-th style="width: 40px" />
            <q-th v-for="col in props.cols" :key="col.name" :props="props">
              {{ col.label }}
            </q-th>
            <q-th auto-width class="text-right">Actions</q-th>
          </q-tr>
        </template>

        <template v-slot:body="props">
          <q-tr
            :props="props"
            :class="{
              'text-red': props.row.referer?.trim().toLowerCase() === 'errored',
            }"
          >
            <q-td auto-width>
              <q-btn
                size="md"
                round
                flat
                dense
                @click="showRowDetails(props.row)"
                icon="info"
                color="grey-8"
              />
            </q-td>

            <q-td v-for="col in props.cols" :key="col.name" :props="props">
              <template v-if="col.name === 'status'">
                <q-icon
                  size="sm"
                  :name="props.row[col.name]"
                  :color="
                    props.row[col.name] === 'check'
                      ? 'green'
                      : props.row[col.name] === 'play_arrow'
                      ? 'blue'
                      : props.row[col.name] === 'close'
                      ? 'red'
                      : props.row[col.name] === 'schedule'
                      ? 'orange'
                      : 'orange'
                  "
                />
              </template>
              <template v-else-if="col.name === 'unique'">
                <q-icon
                  size="sm"
                  :name="props.row[col.name] ? 'check' : 'close'"
                  :color="props.row[col.name] ? 'green' : 'red'"
                />
              </template>
              <template v-else>
                {{ props.row[col.name] }}
              </template>
            </q-td>

            <q-td
              v-if="rowInspection"
              auto-width
              class="text-right sticky-actions"
            >
              <q-btn
                v-if="props.row.isRunning"
                size="sm"
                color="red"
                round
                icon="stop"
                class="q-ma-xs"
                @click="showStopDialog = true"
              />
              <q-btn
                v-if="!hideGenerateContractButton"
                size="sm"
                color="secondary"
                round
                icon="refresh"
                class="q-ma-xs"
                @click="showGenerateDialog = true"
              >
                <q-tooltip anchor="top middle" self="bottom middle">
                  Generate a contract from this point
                </q-tooltip>
              </q-btn>
              <q-btn
                size="sm"
                :color="inspectButtonColor"
                round
                icon="arrow_outward"
                class="q-ma-xs"
                @click="inspectRow(props.row)"
                @contextmenu.prevent="inspectRowInNewTab(props.row)"
              >
                <q-tooltip anchor="top middle" self="bottom middle">
                  Right click to open in new tab
                </q-tooltip>
              </q-btn>
            </q-td>
          </q-tr>
        </template>
      </q-table>

      <!-- Infinite scroll loading indicator -->
      <div
        v-if="infiniteScrollEnabled && loadingMoreData"
        class="infinite-scroll-loading"
      >
        <q-spinner-dots size="20px" color="primary" />
        <div class="loading-text">Loading more data...</div>
      </div>

      <!-- Row Details Dialog -->
      <q-dialog v-model="showDetailsDialog">
        <q-card style="min-width: 400px">
          <q-card-section>
            <div class="text-h6">Details</div>
          </q-card-section>

          <q-card-section>
            <div class="details-content">
              <div class="detail-item">
                <strong>ID:</strong> {{ selectedRow?.uuid }}
              </div>

              <div v-if="selectedRow?.description" class="detail-item">
                <strong>Description:</strong> {{ selectedRow.description }}
              </div>

              <div
                v-if="selectedRow?.concurrency !== undefined"
                class="detail-item"
              >
                <strong>Concurrency:</strong> {{ selectedRow.concurrency }}
              </div>

              <div v-if="selectedRow?.referer" class="detail-item">
                <strong>Referer:</strong> {{ selectedRow.referer }}
              </div>

              <div v-if="selectedRow?.product" class="detail-item">
                <strong>Product:</strong> {{ selectedRow.product }}
              </div>

              <div v-if="selectedRow?.contract" class="detail-item">
                <strong>Contract:</strong>
                <span
                  class="text-secondary cursor-pointer link-text"
                  @click="navigateToItem(`/contracts/${selectedRow.contract}`)"
                >
                  {{ selectedRow.contract }}
                </span>
              </div>

              <div v-if="selectedRow?.processingGraph" class="detail-item">
                <strong>Processing Graph:</strong>
                <span
                  class="text-warning cursor-pointer link-text"
                  @click="
                    navigateToItem(
                      `/activity/servers/${selectedRow.processingGraph}`
                    )
                  "
                >
                  {{ selectedRow.server }}
                </span>
              </div>
            </div>
          </q-card-section>

          <q-card-actions align="right" v-if="rowInspection">
            <q-btn
              v-if="selectedRow?.isRunning"
              color="red"
              icon="stop"
              label="Stop"
              @click="showStopDialog = true"
            />
            <q-btn
              v-if="!hideGenerateContractButton"
              color="secondary"
              icon="refresh"
              label="Generate Contract"
              @click="showGenerateDialog = true"
            />
            <q-btn
              :color="inspectButtonColor"
              icon="arrow_outward"
              label="Inspect"
              @click="inspectRow(selectedRow)"
            />
            <q-btn
              flat
              label="Close"
              color="primary"
              @click="showDetailsDialog = false"
            />
          </q-card-actions>
        </q-card>
      </q-dialog>

      <!-- Dialogs -->
      <q-dialog v-model="showStopDialog">
        <q-card>
          <q-card-section>
            <div class="text-h6">Confirm Stop</div>
            <div>Are you sure you want to stop this process?</div>
          </q-card-section>
          <q-card-actions align="right">
            <q-btn
              flat
              label="Cancel"
              color="primary"
              @click="showStopDialog = false"
            />
            <q-btn flat label="Confirm" color="red" @click="confirmStop" />
          </q-card-actions>
        </q-card>
      </q-dialog>

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

      <!-- Date Range Dialog -->
      <q-dialog v-model="showDateRangeDialog">
        <q-card style="min-width: 500px">
          <q-card-section>
            <div class="text-h6">Select Date Range</div>
          </q-card-section>

          <q-card-section>
            <div class="row q-gutter-md">
              <div class="col">
                <div class="text-subtitle2 q-mb-sm">Start Date</div>
                <q-date
                  v-model="startDate"
                  mask="YYYY-MM-DD"
                  color="primary"
                  @update:model-value="updateDateFilter"
                />
              </div>

              <div class="col">
                <div class="text-subtitle2 q-mb-sm">End Date</div>
                <q-date
                  v-model="endDate"
                  mask="YYYY-MM-DD"
                  color="primary"
                  @update:model-value="updateDateFilter"
                />
              </div>
            </div>
          </q-card-section>

          <q-card-actions align="right">
            <q-btn flat label="Clear" color="grey-6" @click="clearDateFilter" />
            <q-btn
              flat
              label="Close"
              color="primary"
              @click="showDateRangeDialog = false"
            />
          </q-card-actions>
        </q-card>
      </q-dialog>
    </template>
  </InfoCard>
</template>

<script setup lang="ts">
import { useRouter } from '#vue-router';
import { ref, computed, watch } from 'vue';
const router = useRouter();
const appStore = useAppStore();
const inspectButtonColor = computed(() =>
  appStore.currentSection === 'services'
    ? 'primary'
    : appStore.currentSection === 'serviceActivity'
    ? 'warning'
    : 'secondary'
);

const props = defineProps({
  title: {
    type: String,
    default: undefined,
  },
  rows: {
    type: Array,
    required: true,
  },
  columns: {
    type: Array as PropType<
      Array<{
        name: string;
        label: string;
        field: string | ((row: any) => any);
        required?: boolean;
        align?: 'right' | 'left' | 'center';
        sortable?: boolean;
        sort?: (a: any, b: any, rowA: any, rowB: any) => number;
        headerClasses?: string;
      }>
    >,
    default: undefined,
  },
  rowKey: {
    type: String,
    default: 'label',
  },
  rowInspection: {
    type: Boolean,
    default: true,
  },
  externalFilter: {
    type: String,
    default: '',
  },
  hideGenerateContractButton: {
    type: Boolean,
    default: false,
  },
  enableVirtualScroll: {
    type: Boolean,
    default: true,
  },
  virtualScrollItemSize: {
    type: Number,
    default: 48,
  },
  virtualScrollStickyStart: {
    type: Number,
    default: 48,
  },
  virtualScrollStickyEnd: {
    type: Number,
    default: 0,
  },
  enableInfiniteScroll: {
    type: Boolean,
    default: true,
  },
  hasMoreData: {
    type: Boolean,
    default: true,
  },
  loadingMoreData: {
    type: Boolean,
    default: false,
  },
});

const filter = ref(props.externalFilter);

// Date range filter setup
const startDate = ref<string>('');
const endDate = ref<string>('');
const showDateRangeDialog = ref(false);

// Computed property for date range label
const dateRangeLabel = computed(() => {
  if (startDate.value && endDate.value) {
    return `${startDate.value} - ${endDate.value}`;
  } else if (startDate.value) {
    return `From ${startDate.value}`;
  } else if (endDate.value) {
    return `Until ${endDate.value}`;
  }
  return 'Select Date Range';
});

// Computed properties to check if columns exist
const hasStatusColumn = computed(() => {
  return props.columns?.some((col) => col.name === 'status') || false;
});

const hasStartedColumn = computed(() => {
  return props.columns?.some((col) => col.name === 'started') || false;
});

// Status filter setup
const statusOptions = ref([
  { label: 'Completed', value: 'check', icon: 'check', color: 'green' },
  { label: 'Running', value: 'play_arrow', icon: 'play_arrow', color: 'blue' },
  { label: 'Failed', value: 'close', icon: 'close', color: 'red' },
  { label: 'Scheduled', value: 'schedule', icon: 'schedule', color: 'orange' },
]);

const selectedStatuses = ref<string[]>([
  'check',
  'play_arrow',
  'close',
  'schedule',
]);

function updateStatusFilter(newValue: string[]) {
  selectedStatuses.value = newValue;
}

function updateDateFilter() {
  // This function will be called when date changes
  // The filtering logic is in the computed property
}

function clearDateFilter() {
  startDate.value = '';
  endDate.value = '';
  showDateRangeDialog.value = false;
}

// Helper function to parse date strings and compare them
function isDateInRange(
  dateString: string,
  startDateStr: string,
  endDateStr: string
): boolean {
  if (!dateString) return true;

  const date = new Date(dateString);
  const start = startDateStr ? new Date(startDateStr) : null;
  const end = endDateStr ? new Date(endDateStr) : null;

  if (start && date < start) return false;
  if (end && date > end) return false;

  return true;
}

// Fuzzy match helper for partial matches
function fuzzyMatch(str: string, pattern: string) {
  str = str.toLowerCase();
  pattern = pattern.toLowerCase();
  let patternIdx = 0;
  let strIdx = 0;
  while (patternIdx < pattern.length && strIdx < str.length) {
    if (str[strIdx] === pattern[patternIdx]) {
      patternIdx++;
    }
    strIdx++;
  }
  return patternIdx === pattern.length;
}

const filteredRows = computed(() => {
  let rows = props.rows;

  // Apply status filter only if status column exists
  if (hasStatusColumn.value) {
    // If no statuses are selected, show nothing
    if (selectedStatuses.value.length === 0) {
      rows = [];
    } else {
      // If all statuses are selected, show all rows
      const allStatusValues = statusOptions.value.map((opt) => opt.value);
      const shouldFilter =
        selectedStatuses.value.length < allStatusValues.length;

      if (shouldFilter) {
        console.log('Applying status filter:', selectedStatuses.value);
        console.log(
          'Sample row statuses:',
          rows.slice(0, 3).map((row) => (row as any).status)
        );

        rows = rows.filter((row) => {
          const typedRow = row as Record<string, any>;
          const status = typedRow.status;

          // Handle the case where selectedStatuses might contain objects instead of strings
          const selectedValues = selectedStatuses.value.map((item) =>
            typeof item === 'string' ? item : (item as any).value || item
          );

          console.log(
            'Checking row with status:',
            status,
            'against selected values:',
            selectedValues
          );

          // Check if status matches any selected status
          if (selectedValues.includes(status)) {
            return true;
          }

          return false;
        });

        console.log('Filtered rows count:', rows.length);
      }
    }
  }

  // Apply text filter
  if (filter.value) {
    rows = rows.filter(
      (row) =>
        typeof row === 'object' &&
        row !== null &&
        Object.values(row as Record<string, unknown>).some(
          (val) => val && fuzzyMatch(val.toString(), filter.value)
        )
    );
  }

  // Apply date range filter on started field only if started column exists
  if (hasStartedColumn.value && (startDate.value || endDate.value)) {
    rows = rows.filter((row) => {
      const typedRow = row as Record<string, any>;
      const startedValue = typedRow.started;

      return isDateInRange(startedValue, startDate.value, endDate.value);
    });
  }

  return rows;
});

const emit = defineEmits([
  'inspectRow',
  'inspectRowInNewTab',
  'virtualScroll',
  'loadMoreData',
]);
function inspectRow(item: any) {
  emit('inspectRow', item);
}
function inspectRowInNewTab(item: any) {
  emit('inspectRowInNewTab', item);
}
const navigateToItem = (route: string) => {
  router.push(route);
};

const formattedColumns = computed(() => {
  if (!props.columns) {
    return undefined;
  }

  const columns = props.columns.slice();
  columns.unshift({
    name: 'details',
    label: '',
    field: 'details',
    required: true,
    sortable: false,
  });

  return columns;
});

// Virtual scroll computed properties
const virtualScrollEnabled = computed(() => {
  return props.enableVirtualScroll && filteredRows.value.length > 20;
});

const infiniteScrollEnabled = computed(() => {
  return props.enableInfiniteScroll && virtualScrollEnabled.value;
});

const virtualScrollItemSize = computed(() => props.virtualScrollItemSize);
const virtualScrollStickyStart = computed(() => props.virtualScrollStickyStart);
const virtualScrollStickyEnd = computed(() => props.virtualScrollStickyEnd);

// Virtual scroll event handler
function onVirtualScroll(details: any) {
  // Handle virtual scroll events
  console.log('Virtual scroll:', details);

  // Emit virtual scroll event for parent
  emit('virtualScroll', details);

  // Check for infinite scroll trigger
  if (
    props.enableInfiniteScroll &&
    props.hasMoreData &&
    !props.loadingMoreData
  ) {
    const { to, direction } = details;
    const totalRows = filteredRows.value.length;

    // Trigger load more when scrolling down and near the end (within 10 items)
    if (direction === 'increase' && to >= totalRows - 10) {
      emit('loadMoreData');
    }
  }
}

const showStopDialog = ref(false);
const showGenerateDialog = ref(false);
const showDetailsDialog = ref(false);
const selectedRow = ref<any>(null);

function showRowDetails(row: any) {
  selectedRow.value = row;
  showDetailsDialog.value = true;
}

function confirmStop() {
  showStopDialog.value = false;
  // Add logic to handle stopping the process
}

function confirmGenerate() {
  showGenerateDialog.value = false;
  // Add logic to handle generating the contract
}

defineExpose({
  inspectRow,
  inspectRowInNewTab,
  navigateToItem,
  filteredRows,
  showRowDetails,
  virtualScrollEnabled,
  infiniteScrollEnabled,
  clearDateFilter,
  updateDateFilter,
});
</script>
<style scoped>
.my-sticky-last-column-table {
  height: 310px;
  max-width: 100%;
}

.my-sticky-last-column-table td:last-child {
  background-color: #848485;
}

.my-sticky-last-column-table tr th {
  position: sticky;
  z-index: 2;
  background: #848485;
}

.my-sticky-last-column-table thead tr:last-child th {
  top: 48px;
  z-index: 3;
}

.my-sticky-last-column-table thead tr:first-child th {
  top: 0;
  z-index: 1;
}

.my-sticky-last-column-table tr:last-child th:last-child {
  z-index: 3;
}

.my-sticky-last-column-table td:last-child {
  z-index: 1;
}

.my-sticky-last-column-table td:last-child,
.my-sticky-last-column-table th:last-child {
  position: sticky;
  right: 0;
}

.my-sticky-last-column-table tbody {
  scroll-margin-top: 48px;
}

.sticky-actions {
  position: sticky;
  right: 0;
  z-index: 1;
  background-color: #848485;
}

/* Virtual scroll optimizations */
.my-sticky-last-column-table :deep(.q-virtual-scroll__content) {
  contain: layout style paint;
}

.my-sticky-last-column-table :deep(.q-virtual-scroll__padding) {
  will-change: transform;
}

/* Infinite scroll loading indicator */
.infinite-scroll-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background-color: rgba(0, 0, 0, 0.02);
  border-top: 1px solid rgba(0, 0, 0, 0.1);
}

.loading-text {
  margin-top: 8px;
  font-size: 14px;
  color: #a8a9aa;
}

/* Details dialog styles */
.details-content {
  max-height: 400px;
  overflow-y: auto;
}

.detail-item {
  margin-bottom: 12px;
  padding: 8px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}

.detail-item:last-child {
  border-bottom: none;
  margin-bottom: 0;
}

.link-text {
  text-decoration: underline;
  transition: opacity 0.2s ease;
}

.link-text:hover {
  opacity: 0.7;
}

/* Date range filter outline */
.date-range-filter {
  outline: 1px solid #a8a9aa;
  outline-offset: -1px;
  border-radius: 4px;
  padding: 0px 4px;
}
</style>
