({
    doInit: function(component, event, helper) {
        debugger;
        let pageRef = component.get("v.pageReference");
        let parentId, parentObjectApiName;

        if (pageRef && pageRef.state && pageRef.state.inContextOfRef) {
            let base64Context = pageRef.state.inContextOfRef;

            // Handle "1." prefix if present
            if (base64Context.startsWith("1.")) {
                base64Context = base64Context.substring(2);
            } 

            try {
                let addressableContext = JSON.parse(window.atob(base64Context));

                // Standard record page usually has attributes.recordId; objectApiName may be missing
                parentId = addressableContext.attributes.recordId;
                parentObjectApiName = addressableContext.attributes.objectApiName
                    || addressableContext.attributes.apiName   // sometimes apiName is used
                    || pageRef.attributes.objectApiName        // fallback
                    || null;
            } catch(e) {
                // ignore parsing errors; we’ll rely on other fallbacks
            }
        }

        // As a final fallback, if Aura has a recordId injected (override context), use it
        if (!parentId) {
            parentId = component.get("v.recordId");
        }

        component.set("v.parentRecordId", parentId || null);
        
    }
})