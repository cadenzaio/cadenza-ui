<template>
  <g :class="['custom', ...edgeClasses]" :style="cssVars" aria-hidden="true" focusable="false">
    <BaseEdge :id="id" :path="pathString" :style="{ fill: 'none', ...style }" />
  </g>
</template>
<script setup>
import { BaseEdge, getBezierPath } from "@vue-flow/core";
import { computed } from 'vue';

const props = defineProps([
  'id',
  'sourceX',
  'sourceY',
  'targetX',
  'targetY',
  'sourcePosition',
  'targetPosition',
  'style',
  'data', 
]);

const bezierResult = computed(() => {
  const sx = Number(props.sourceX);
  const sy = Number(props.sourceY);
  const tx = Number(props.targetX);
  const ty = Number(props.targetY);

  if ([sx, sy, tx, ty].some((n) => !isFinite(n))) {
    return ['', 0, 0];
  }

  return getBezierPath({
    sourceX: sx,
    sourceY: sy,
    targetX: tx,
    targetY: ty,
    sourcePosition: props.sourcePosition,
    targetPosition: props.targetPosition,
  });
});

const pathString = computed(() => bezierResult.value?.[0] ?? '');

const edgeClasses = computed(() => {
  const d = props.data || {};
  return [
    d.errored ? 'errored' : null,
    d.failed ? 'failed' : null,
    d.isRunning ? 'running' : null,
    d.signal ? 'signal' : null,
    d.meta ? 'meta' : null,
    d.dashed ? 'dashed' : null,
    d.highlight ? 'highlight' : null,
    d.customClass || null,
  ].filter(Boolean);
});

const cssVars = computed(() => {
  const vars = {};
  if (props.data?.strokeColor) vars['--edge-stroke'] = String(props.data.strokeColor);
  if (props.data?.strokeWidth) vars['--edge-stroke-width'] = String(props.data.strokeWidth);
  return vars;
});
</script>

<style scoped>
.custom path {
  stroke: var(--edge-stroke, #ff69b4)!important;
  stroke-width: var(--edge-stroke-width, 6);
  fill: none;
  transition: stroke 160ms ease, stroke-width 160ms ease, stroke-dashoffset 300ms linear;
  stroke-linecap: round;
}

.custom:hover path {
  stroke-width: calc(var(--edge-stroke-width, 6) + 2);
}

.custom.errored path {
  stroke: #d37b7b;
}
.custom.failed path {
  stroke: #b33a3a;
}
.custom.running path {
  stroke: #ffb86b;
  stroke-dasharray: 6 6;
  animation: edge-dash 1s linear infinite;
}
.custom.signal path {
  stroke: #00d1ff;
  stroke-dasharray: 6 6;
  animation: edge-dash 1s linear infinite;
}
.custom.meta path {
  stroke: #ab0ac0;
}
.custom.dashed path {
  stroke-dasharray: 8 6;
}
.custom.highlight path {
  stroke: #ffea00;
  stroke-width: calc(var(--edge-stroke-width, 6) + 4);
}

@keyframes edge-dash {
  to { stroke-dashoffset: -24; }
}

</style>
