<script setup lang="ts">
defineProps<{ kind: string }>()
</script>

<template>
  <svg class="course-art" viewBox="0 0 160 140" fill="none" aria-hidden="true">
    <template v-if="kind === 'machine-learning'">
      <path d="M24 111H139M32 115V25" class="art-ink" />
      <path d="M43 93C64 83 79 62 101 57C112 54 121 39 136 29" class="art-ink art-draw" stroke-dasharray="5 7" />
      <circle cx="49" cy="87" r="8" class="art-fill" /><circle cx="75" cy="76" r="8" class="art-fill" />
      <circle cx="102" cy="54" r="8" class="art-fill" /><circle cx="128" cy="35" r="8" class="art-fill" />
      <path d="m110 93 7-13 7 13 14 3-14 6-7 13-7-13-14-6 14-3Z" class="art-accent" />
    </template>
    <template v-else-if="kind === 'data-engineering'">
      <path d="M37 42H71Q85 42 85 57V85Q85 99 103 99H126" class="art-ink art-draw" stroke-dasharray="5 6" />
      <ellipse cx="36" cy="35" rx="22" ry="10" class="art-fill" /><path d="M14 35v26c0 14 44 14 44 0V35M14 49c0 14 44 14 44 0" class="art-ink" />
      <rect x="105" y="77" width="39" height="43" rx="5" class="art-fill" />
      <path d="M115 88h19M115 98h19M115 108h10M99 28l8 8-8 8M107 36H79" class="art-ink" />
      <circle cx="77" cy="106" r="8" class="art-accent" />
    </template>
    <template v-else-if="kind === 'mlops'">
      <path d="M43 94c-35-8-25-58 12-58h12M117 36c36 5 30 58-9 58H96" class="art-ink art-draw" />
      <path d="m57 25 13 11-13 10M105 84 92 94l13 12" class="art-ink" />
      <rect x="54" y="49" width="47" height="40" rx="7" class="art-fill" />
      <path d="m68 69 7 7 13-15" class="art-ink" />
      <circle cx="127" cy="118" r="8" class="art-accent" />
    </template>
    <template v-else>
      <path d="M29 35h85a10 10 0 0 1 10 10v41a10 10 0 0 1-10 10H69l-22 18V96H29a10 10 0 0 1-10-10V45a10 10 0 0 1 10-10Z" class="art-fill" />
      <path d="M38 56h65M38 70h45M38 84h27" class="art-ink" />
      <path d="m128 17 5-13 6 13 14 6-14 5-6 14-5-14-14-5 14-6ZM119 107l4-8 4 8 8 4-8 4-4 9-4-9-9-4 9-4Z" class="art-accent" />
    </template>
  </svg>
</template>
