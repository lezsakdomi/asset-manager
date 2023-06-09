export default new Promise((resolve) => {
    if (document.readyState === 'complete') {
        resolve();
    } else {
        document.addEventListener('DOMContentLoaded', resolve);
    }
});
