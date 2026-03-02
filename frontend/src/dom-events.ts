interface StaticDomHandlers {
    openLabelManager?: (scope: string) => void;
    closeLabelManager?: () => void;
}

export function bindStaticDomEvents(handlers: StaticDomHandlers = {}): void {
    const { openLabelManager, closeLabelManager } = handlers;

    const dueDateInput = document.getElementById('panelDueDate') as HTMLInputElement | null;
    if (dueDateInput) {
        dueDateInput.addEventListener('focus', () => {
            dueDateInput.type = 'date';
        });

        dueDateInput.addEventListener('blur', () => {
            if (!dueDateInput.value) {
                dueDateInput.type = 'text';
            }
        });
    }

    const openLabelLink = document.querySelector('[data-action="open-label-manager"]');
    if (openLabelLink) {
        openLabelLink.addEventListener('click', (event) => {
            event.preventDefault();
            if (typeof openLabelManager === 'function') {
                openLabelManager('global');
            }
        });
    }

    const closeOverlay = document.querySelector('[data-action="close-label-manager"]');
    if (closeOverlay) {
        closeOverlay.addEventListener('click', () => {
            if (typeof closeLabelManager === 'function') {
                closeLabelManager();
            }
        });
    }
}
