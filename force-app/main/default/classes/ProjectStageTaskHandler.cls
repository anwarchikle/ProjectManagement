public class ProjectStageTaskHandler {
    
    
    public static void validateProjectManager(
    List<Project__c> newList,
    Map<Id, Project__c> oldMap){

    Set<Id> projectIdsToCheck = new Set<Id>();

    for(Project__c proj : newList){

        // Moving TO Pre Kick off
        if(proj.Status__c == 'Pre Kick off' &&
           oldMap.get(proj.Id).Status__c != 'Pre Kick off'){

            projectIdsToCheck.add(proj.Id);
        }
    }

    if(projectIdsToCheck.isEmpty()) return;

    // Query Team Members
    List<Project_Team_Member__c> teamMembers =
        [SELECT Project__c
         FROM Project_Team_Member__c
         WHERE Project__c IN :projectIdsToCheck
         AND Role__c = 'Project Manager'];

    Set<Id> projectsWithPM = new Set<Id>();

    for(Project_Team_Member__c ptm : teamMembers){
        projectsWithPM.add(ptm.Project__c);
    }

    // Add error if missing
    for(Project__c proj : newList){

        if(projectIdsToCheck.contains(proj.Id) &&
           !projectsWithPM.contains(proj.Id)){

            proj.Status__c.addError(
                'Add Project Manager in Project Team Members before moving to Pre Kick off.'
            );
        }
    }
}

     public static void processProjects(List<Project__c> newList,
                                       Map<Id, Project__c> oldMap,
                                       Boolean isInsert){

        Set<String> stagesToProcess = new Set<String>();
        List<Project__c> projectsToProcess = new List<Project__c>();

        for(Project__c proj : newList){

            if(isInsert){
                if(proj.Status__c != null){
                    stagesToProcess.add(proj.Status__c);
                    projectsToProcess.add(proj);
                }
            }
            else{
                if(proj.Status__c != oldMap.get(proj.Id).Status__c){
                    if(proj.Status__c != null){
                        stagesToProcess.add(proj.Status__c);
                        projectsToProcess.add(proj);
                    }
                }
            }
        }

        if(projectsToProcess.isEmpty()) return;


        List<Project_Stage_Task_Config__mdt> metaList =
            [SELECT Status__c,
                    Task_Subject__c,
                    Owner_Role__c,
                    Sequence__c
             FROM Project_Stage_Task_Config__mdt
             WHERE Status__c IN :stagesToProcess
             AND Is_Active__c = TRUE
             ORDER BY Sequence__c ASC];


        Set<Id> projectIds = new Set<Id>();
        for(Project__c p : projectsToProcess){
            projectIds.add(p.Id);
        }


        List<Project_Team_Member__c> teamMembers =
            [SELECT Project__c, Role__c, Assigned_To__c
             FROM Project_Team_Member__c
             WHERE Project__c IN :projectIds];

      
        Map<String, Id> projectRoleUserMap = new Map<String, Id>();

        for(Project_Team_Member__c ptm : teamMembers){
            if(ptm.Assigned_To__c != null && ptm.Role__c != null){
                String key = ptm.Project__c + '-' + ptm.Role__c;
                projectRoleUserMap.put(key, ptm.Assigned_To__c);
            }
        }

        List<Task> tasksToInsert = new List<Task>();

        for(Project__c proj : projectsToProcess){

            for(Project_Stage_Task_Config__mdt meta : metaList){

                if(proj.Status__c == meta.Status__c){

                    Task t = new Task();
                    t.Subject = meta.Task_Subject__c;
                    t.WhatId = proj.Id;
                    t.Status = 'Not Started';
                    t.Priority = 'Normal';

                    String mapKey = proj.Id + '-' + meta.Owner_Role__c;

                    if(projectRoleUserMap.containsKey(mapKey)){
                        t.OwnerId = projectRoleUserMap.get(mapKey);
                    } else {
                        t.OwnerId = proj.OwnerId;
                    }

                    tasksToInsert.add(t);
                }
            }
        }

        if(!tasksToInsert.isEmpty()){
            insert tasksToInsert;
        }
    }
}