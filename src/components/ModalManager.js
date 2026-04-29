import { LibraryModal } from './modals/LibraryModal.js';
import { RedrawModal } from './modals/RedrawModal.js';
import { ApiConfigModal } from './modals/ApiConfigModal.js';
import { HistoryDetailModal } from './modals/HistoryDetailModal.js';
import { InfoModal } from './modals/InfoModal.js';

export function injectModals() {
    const container = document.createElement('div');
    container.innerHTML = [
        LibraryModal,
        RedrawModal,
        ApiConfigModal,
        HistoryDetailModal,
        InfoModal
    ].join('');
    
    while (container.firstChild) {
        document.body.appendChild(container.firstChild);
    }
}
