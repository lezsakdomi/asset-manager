export default new Promise((resolve) => {
    document.addEventListener('DOMContentLoaded', resolve)
})