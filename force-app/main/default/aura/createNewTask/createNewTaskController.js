({
    doInit: function(component, event, helper) {
        let pageRef = component.get("v.pageReference");
        let parentId;
        
        if (pageRef && pageRef.state) {
            if (pageRef.state.inContextOfRef) {
                let base64Context = pageRef.state.inContextOfRef;
                if (base64Context.startsWith("1.")) base64Context = base64Context.substring(2);
                try {
                    let ctx = JSON.parse(window.atob(base64Context));
                    parentId = ctx.attributes && ctx.attributes.recordId;
                } catch(e) {}
            }
            if (!parentId) {
                parentId = pageRef.state.recordId || pageRef.state.c__recordId || pageRef.state.c__parentId || null;
            }
        }

        if (!parentId) parentId = component.get("v.recordId");
        component.set("v.parentRecordId", parentId || null);

        var isCommunity = false;
        try { isCommunity = (window.location.pathname || '').indexOf('/s/') !== -1; } catch(e) {}
        component.set("v.isCommunity", isCommunity);

        if (!isCommunity) return;

        function auraClose() {
            try { var e = $A.get("e.force:closeQuickAction"); if (e) e.fire(); } catch(e) {}
            try {
                var w = window;
                while (w.parent && w.parent !== w) {
                    w = w.parent;
                    try { var e = w.$A && w.$A.get("e.force:closeQuickAction"); if (e) e.fire(); } catch(e) {}
                }
            } catch(e) {}
        }

        function domClose() {
            var selectors = ['button[title="Close"]', '.slds-modal__close', 'button[aria-label="Close"]', 'button.close'];
            var found = selectors.some(function(sel) {
                var btn = document.querySelector(sel) || (window.parent !== window && window.parent.document.querySelector(sel));
                if (btn) { btn.click(); return true; }
            });
            if (!found) {
                ['.slds-modal__container', '.slds-backdrop', '.forceActionContainer'].forEach(function(sel) {
                    document.querySelectorAll(sel).forEach(function(el) { el.style.display = 'none'; });
                    try { window.parent.document.querySelectorAll(sel).forEach(function(el) { el.style.display = 'none'; }); } catch(e) {}
                });
            }
        }

        auraClose(); domClose();
        [100, 300, 600].forEach(function(t) { window.setTimeout(function() { auraClose(); domClose(); }, t); });

        var targetUrl = '/s/new-task' + (parentId ? '?recordId=' + parentId : '');
        window.setTimeout(function() { window.open(targetUrl, '_blank'); }, 400);
    }
})