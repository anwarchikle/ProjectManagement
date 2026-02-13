trigger TriggerOnProjectTeamMember on Project_Team_Member__c (after insert, after update, after delete, after undelete) {
   /* if (Trigger.isAfter) {
        if (Trigger.isInsert) {
            //ProjectSharingHandler.shareForInsertedMembers(Trigger.new);
            //ProjectSharingHandler.cascadeShareForInsertedMembers(Trigger.new);
        }
        
        if (Trigger.isUpdate) {
            //ProjectSharingHandler.shareDeltaForUpdatedMembers(Trigger.new, Trigger.oldMap);
            //ProjectSharingHandler.cascadeShareDeltaForUpdatedMembers(Trigger.new, Trigger.oldMap);
        }
        
        if (Trigger.isDelete) {
            //ProjectSharingHandler.unshareForDeletedMembers(Trigger.old);
            //ProjectSharingHandler.cascadeUnshareForDeletedMembers(Trigger.old);
        }
        
        if (Trigger.isUndelete) {
            //ProjectSharingHandler.shareForInsertedMembers(Trigger.new);
            //ProjectSharingHandler.cascadeShareForInsertedMembers(Trigger.new);
        }
    } */
    
    if(trigger.isInsert && trigger.isAfter){
        ProjectSharingHandlerNew.giveVisibilityOnInsert(trigger.new);
    }
    if(trigger.isUpdate && trigger.isAfter){
        ProjectSharingHandlerNew.giveVisibilityOnUpdate(trigger.new,trigger.OldMap);
    }
    if(trigger.isDelete && trigger.isAfter){
        ProjectSharingHandlerNew.removeVisibility(trigger.old);
    }
}