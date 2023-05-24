export default Promise.race([new Promise((resolve) => {
    document.addEventListener('DOMContentLoaded', resolve);
})], new Promise(resolve => setTimeout(resolve, 3000)));
// todo better to check for DOM state or sth
