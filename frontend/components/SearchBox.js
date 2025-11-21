class SearchBox {
    constructor(inputId, buttonId) {
        this.searchInput = document.getElementById(inputId);
        this.searchButton = document.getElementById(buttonId);
        this.onSearch = null;
    }

    // 初始化搜索功能
    init() {
        this.searchButton.addEventListener('click', () => {
            this.performSearch();
        });

        this.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.performSearch();
            }
        });
    }

    // 执行搜索
    performSearch() {
        const keyword = this.searchInput.value.trim();
        
        if (!keyword) {
            alert('请输入搜索关键词');
            return;
        }

        if (this.onSearch) {
            this.onSearch(keyword);
        }
    }

    // 设置搜索回调
    setOnSearch(callback) {
        this.onSearch = callback;
    }

    // 清空搜索
    clear() {
        this.searchInput.value = '';
    }

    // 获取搜索关键词
    getKeyword() {
        return this.searchInput.value.trim();
    }
}