({
    doInit: function(component, event, helper) {
        debugger;
        let pageRef = component.get("v.pageReference");
        let parentId, parentObjectApiName;
        
        if (pageRef && pageRef.state) {
            if (pageRef.state.inContextOfRef) {
                let base64Context = pageRef.state.inContextOfRef;
                if (base64Context.startsWith("1.")) {
                    base64Context = base64Context.substring(2);
                }
                
                try {
                    let addressableContext = JSON.parse(window.atob(base64Context));
                    parentId = addressableContext.attributes && addressableContext.attributes.recordId;
                    parentObjectApiName = (addressableContext.attributes &&
                                           (addressableContext.attributes.objectApiName
                                            || addressableContext.attributes.apiName))
                    || (pageRef.attributes && pageRef.attributes.objectApiName)
                    || null;
                } catch(e) {
                    
                }
            }
            
            if (!parentId) {
                parentId = pageRef.state.recordId
                || pageRef.state.c__recordId
                || pageRef.state.c__parentId
                || null;
            }
        }
        if (!parentId) {
            parentId = component.get("v.recordId");
        }
        
        component.set("v.parentRecordId", parentId || null);
        var isCommunity = false;
        try {
            var path = window.location.pathname || '';
            if (path.indexOf('/s/') !== -1) {
                isCommunity = true;
            }
        } catch (e) {}
        
        component.set("v.isCommunity", isCommunity);
        
        if (isCommunity) {
            function closeQuickAction() {
                // Try current context
                var closeEvt = $A.get("e.force:closeQuickAction");
                if (closeEvt) {
                    closeEvt.fire();
                    return true;
                }
                try {
                    if (window.parent && window.parent.$A) {
                        closeEvt = window.parent.$A.get("e.force:closeQuickAction");
                        if (closeEvt) {
                            closeEvt.fire();
                            return true;
                        }
                    }
                } catch (e) {
                    
                }
                return false;
            }
            
            closeQuickAction();
            
            if (parentId) {
                var url = '/s/new-task?recordId=' + parentId;
                window.open(url, '_blank');
            } else {
                window.open('/s/new-task', '_blank');
            }
            return;
        }
    }
})