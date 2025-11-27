<template>
  <!-- aria-hidden and focusable ensure edge visuals don't interfere with screen reader focus -->
  <g :class="['custom', ...edgeClasses]" :style="cssVars" aria-hidden="true" focusable="false">
    <!-- BaseEdge will render the actual path; we pass a defensive path string so
         the renderer never receives undefined. -->
    <BaseEdge :id="id" :path="pathString" :style="{ fill: 'none', ...style }" />
  </g>
</template>
<script setup>
import { BaseEdge, getBezierPath } from "@vue-flow/core";
import { computed } from 'vue';

// Explicit props shape — keep it permissive but make intent clear.
const props = defineProps([
  'id',
  'sourceX',
  'sourceY',
  'targetX',
  'targetY',
  'sourcePosition',
  'targetPosition',
  'style',
  'data', // Accept additional data for dynamic styling
]);

// Defensive computed path: only compute when numeric coordinates are present.
const bezierResult = computed(() => {
  const sx = Number(props.sourceX);
  const sy = Number(props.sourceY);
  const tx = Number(props.targetX);
  const ty = Number(props.targetY);

  if ([sx, sy, tx, ty].some((n) => !isFinite(n))) {
    // Return a harmless empty path and center coords — prevents errors during initial layout.
    return ['', 0, 0];
  }

  // Call getBezierPath with an explicit object so it only receives the fields it expects.
  return getBezierPath({
    sourceX: sx,
    sourceY: sy,
    targetX: tx,
    targetY: ty,
    sourcePosition: props.sourcePosition,
    targetPosition: props.targetPosition,
  });
});

// pathString is the SVG path string (or empty string if not computable yet)
const pathString = computed(() => bezierResult.value?.[0] ?? '');

// compute classes from data to mimic CustomNode behavior (non-mutating)
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

// expose CSS variables so inline data can still set colors/widths while allowing
// CSS classes to override as needed
const cssVars = computed(() => {
  const vars = {};
  if (props.data?.strokeColor) vars['--edge-stroke'] = String(props.data.strokeColor);
  if (props.data?.strokeWidth) vars['--edge-stroke-width'] = String(props.data.strokeWidth);
  return vars;
});
</script>

<style scoped>
.custom path {
  /* Use CSS variables so data-provided values can set them inline without
     blocking class-based overrides. */
  stroke: var(--edge-stroke, #ff69b4)!important;
  stroke-width: var(--edge-stroke-width, 6);
  fill: none;
  transition: stroke 160ms ease, stroke-width 160ms ease, stroke-dashoffset 300ms linear;
  stroke-linecap: round;
}

.custom:hover path {
  /* gentle hover highlight unless a class overrides it */
  stroke-width: calc(var(--edge-stroke-width, 6) + 2);
}

/* Class variants */
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
