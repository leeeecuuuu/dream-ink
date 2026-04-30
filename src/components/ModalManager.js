import { LibraryModal } from './modals/LibraryModal.js';
import { ApiConfigModal } from './modals/ApiConfigModal.js';
import { HistoryDetailModal } from './modals/HistoryDetailModal.js';
import { InfoModal } from './modals/InfoModal.js';
import { SyncConfigModal } from './modals/SyncConfigModal.js';

export function injectModals() {
    const container = document.createElement('div');
    container.innerHTML = [
        LibraryModal,
        ApiConfigModal,
        HistoryDetailModal,
        InfoModal,
        SyncConfigModal
    ].join('');
    
    while (container.firstChild) {
        document.body.appendChild(container.firstChild);
    }
}
