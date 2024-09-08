//
export default {
  props: {
    path: { type: String, default: '/' },
    params: { type: Object, default: () => ({}) }
  },
  data() {
    return {
      loading: true,
      error: null,
      body: null,
    }
  },
  watch: {
    path() {
      this.request()
    },
    params: {
      handler() {
        this.request()
      },
      deep: true,
    },
  },
  methods: {
    async request() {
      this.loading = true
      try {
        const { data } = await window.$axios.request({
          data: {
            devMode: true,
            function: '$view',
            parameters: [{ path, params }], } })
        this.error = null
        this.body = data
      } catch (error) {
        this.error = error
        this.body = null
      }
      this.loading = false
    }
  },
  mounted() {
    this.request()
  },
  render() {
    return this.slots?.default({
      loading: this.loading || true,
      error: this.error || null,
      body: this.body || null, })
  },
}
