Component({
  properties: {
    summary: {
      type: Object,
      value: undefined,
    },
  },
  methods: {
    onPreview() {
      const summary = this.properties.summary as { mainImage?: string } | undefined;
      if (!summary?.mainImage) {
        return;
      }

      this.triggerEvent('preview', {
        url: summary.mainImage,
      });
    },
  },
});
