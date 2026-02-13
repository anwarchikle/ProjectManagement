({
    doInit : function(component, event, helper) {
        var recordId = component.get("v.recordId");
        
        var compDefinition = {
            componentDef: "c:projectStatusReport",
            attributes: {
                recordId: recordId
            }
        };
        
        var encodedDef = btoa(JSON.stringify(compDefinition));
        var url = "/one/one.app#" + encodedDef;
        window.open(url, '_blank');
        $A.get("e.force:closeQuickAction").fire();
    }
})