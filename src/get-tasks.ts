import * as common from './common';
import * as nodeApi from 'azure-devops-node-api';

import * as CoreApi from 'azure-devops-node-api/CoreApi';
import * as CoreInterfaces from 'azure-devops-node-api/interfaces/CoreInterfaces';


import Colors = require('colors/safe');
import * as IBuildApi from 'azure-devops-node-api/interfaces/BuildInterfaces';
import { TaskDefinition, TaskVersion, TaskGroupStep } from 'azure-devops-node-api/interfaces/TaskAgentInterfaces';
import { ReleaseDefinition } from 'azure-devops-node-api/interfaces/ReleaseInterfaces';
import { DefinitionType } from 'azure-devops-node-api/interfaces/BuildInterfaces';

// TODO: make a better implementation
function matchesVersion(versionSpec: string, version: TaskVersion): boolean {

    return version.major.toString() === versionSpec.replace(".*", "");
}

function isTaskInstalled(installedTasks: TaskDefinition[], taskId: string, versionSpec: string) {

    return installedTasks.find(t => { return t.id === taskId && matchesVersion(versionSpec, t.version); });
}

/// Try to get the task name regardless of the version in case only the version is missing but the task exists.
function tryGetTaskName(installedTasks: TaskDefinition[], taskId: string) {

    let taskName = installedTasks.find(t => { return t.id === taskId })?.name;

    if(taskName) {
        return `${taskName} ${taskId}`
    }

    return taskId;
}

function dumpPipelineMissingTasks(installedTasks: TaskDefinition[], definition: IBuildApi.BuildDefinition, skipOK: boolean) {

    let process = definition.process as IBuildApi.DesignerProcess
    let shownName = false;

    for (var phaseKey in process.phases) {
        const phase = process.phases[phaseKey];

        for (var stepKey in phase.steps) {

            const step = phase.steps[stepKey];
            const stepTask = step.task;

            if (stepTask.definitionType !== "task" || isTaskInstalled(installedTasks, stepTask.id, stepTask.versionSpec)) {
                continue;
            }

            if (shownName === false) {
                common.result(`${Colors.red("NOK")} Pipeline: ${definition.name}`);
            }
            shownName = true;

            common.result(`  ${tryGetTaskName(installedTasks,stepTask.id)} ${stepTask.versionSpec} ${step.displayName} [${phase.name}]`);
        }
    }

    if (shownName === false && skipOK === false) {
        common.result(`${Colors.green("OK")} Pipeline: ${definition.name}`);
    }
}

function dumpTaskGroupMissingTasks(installedTasks: TaskDefinition[], steps: TaskGroupStep[], friendlyName: string, skipOK: boolean) {

    let shownName = false;

    for (var stepKey in steps) {

        const step = steps[stepKey];
        const stepTask = step.task;

        if (stepTask.definitionType !== "task" || isTaskInstalled(installedTasks, stepTask.id, stepTask.versionSpec)) {
            continue;
        }

        if (shownName === false) {
            common.result(`${Colors.red("NOK")} Task Group: ${friendlyName}`);
        }
        shownName = true;
        common.result(`  ${tryGetTaskName(installedTasks,stepTask.id)} ${stepTask.versionSpec} ${step.displayName}`);
    }

    if (shownName === false && skipOK === false) {
        common.result(`${Colors.green("OK")} Task Group: ${friendlyName}`);
    }
}

function dumpReleaseMissingTasks(installedTasks: TaskDefinition[], releaseDefinition: ReleaseDefinition, skipOK: boolean) {

    let shownName = false;

    for (var environmentKey in releaseDefinition.environments) {
        let environment = releaseDefinition.environments[environmentKey];

        for (var phaseKey in environment.deployPhases) {
            const phase = environment.deployPhases[phaseKey];

            for (var stepKey in phase.workflowTasks) {

                const step = phase.workflowTasks[stepKey];

                if (step.definitionType !== "task" || isTaskInstalled(installedTasks, step.taskId, step.version)) {
                    continue;
                }

                if (shownName === false && skipOK === false) {
                    common.result(`${Colors.red("NOK")} Release: ${releaseDefinition.name}`);
                }
                shownName = true;
                common.result(`  ${tryGetTaskName(installedTasks,step.taskId)} ${step.version} ${step.name} [${environment.name}] ->[${phase.name}]`);
            }
        }
    }

    if (shownName === false && skipOK === false) {
        common.result(`${Colors.green("OK")} Release: ${releaseDefinition.name}`);
    }
}

export async function run(organizationUrl: string, projectName: string, skipOK: boolean) {
    const webApi: nodeApi.WebApi = await common.getWebApi(organizationUrl);

    const coreApiObject: CoreApi.CoreApi = await webApi.getCoreApi();
    const taskAgentApi = await webApi.getTaskAgentApi();
    const releaseApi = await webApi.getReleaseApi();
    const buildApi = await webApi.getBuildApi();

    if (skipOK) {
        console.log(Colors.yellow("Will skip ok results"));
    }

    common.heading("Getting tasks");

    const installedTasks = await taskAgentApi.getTaskDefinitions();

    common.result(`Found ${installedTasks.length} tasks`);

    common.heading("Getting projects");

    const projects: CoreInterfaces.TeamProjectReference[] = await coreApiObject.getProjects();

    for (var projectReference in projects) {
        const project = projects[projectReference];

        if (projectName && project.name !== projectName) {
            continue;
        }

        common.heading(`Project: ${project.name}`);

        const pipelines = await buildApi.getDefinitions(project.id);

        for (var pipelineName in pipelines) {
            const pipeline = pipelines[pipelineName];

            if (pipeline.type === DefinitionType.Build) {

                const definition = await buildApi.getDefinition(project.id, pipeline.id);

                dumpPipelineMissingTasks(installedTasks, definition, skipOK);

            } else {
                common.result(`skipping YAML ${pipeline.name}`)
            }
        }

        const taskGroups = await taskAgentApi.getTaskGroups(project.id);

        for (var taskGroupKey in taskGroups) {
            const taskGroup = taskGroups[taskGroupKey];

            dumpTaskGroupMissingTasks(installedTasks, taskGroup.tasks, taskGroup.friendlyName, skipOK);

        }

        var releaseDefinitions = await releaseApi.getReleaseDefinitions(project.id);

        for (var releaseDefinitionName in releaseDefinitions) {

            const releaseDefinition = await releaseApi.getReleaseDefinition(project.id, releaseDefinitions[releaseDefinitionName].id);

            dumpReleaseMissingTasks(installedTasks, releaseDefinition, skipOK);
        }
    }
}

///////////////////////////////////////////////////// main

if (process.env["API_TOKEN"] === null) {
    console.error("You need to define an environment variable called API_TOKEN with your Personal access token (PAT)")
    process.exit(-3);
}

const yargs = require('yargs');

const argv: any = require('yargs')
    .usage('Usage: $0 --org organizationUrl --project projectName --skipOK')
    .demandOption(['org'])
    .alias('org', 'organization')
    .alias('p', 'project')
    .option('skipOK', {
        type: 'boolean',
        alias: 'skipok',
        default: false,
        description: 'skip ok results'
    })
    .describe('org', 'Organization url eg: https://dev.azure.com/myOrg')
    .describe('p', 'Team project name')
    .argv;

run(argv.org, argv.project, argv.skipOK)


