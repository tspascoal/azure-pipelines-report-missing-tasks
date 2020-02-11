"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const common = require("./common");
const Colors = require("colors/safe");
const BuildInterfaces_1 = require("azure-devops-node-api/interfaces/BuildInterfaces");
// TODO: make a better implementation
function matchesVersion(versionSpec, version) {
    return version.major.toString() === versionSpec.replace(".*", "");
}
function isTaskInstalled(installedTasks, taskId, versionSpec) {
    return installedTasks.find(t => { return t.id === taskId && matchesVersion(versionSpec, t.version); });
}
/// Try to get the task name regardless of the version in case only the version is missing but the task exists.
function tryGetTaskName(installedTasks, taskId) {
    var _a;
    let taskName = (_a = installedTasks.find(t => { return t.id === taskId; })) === null || _a === void 0 ? void 0 : _a.name;
    if (taskName) {
        return `${taskName} ${taskId}`;
    }
    return taskId;
}
function dumpPipelineMissingTasks(installedTasks, definition, skipOK) {
    let process = definition.process;
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
            common.result(`  ${tryGetTaskName(installedTasks, stepTask.id)} ${stepTask.versionSpec} ${step.displayName} [${phase.name}]`);
        }
    }
    if (shownName === false && skipOK === false) {
        common.result(`${Colors.green("OK")} Pipeline: ${definition.name}`);
    }
}
function dumpTaskGroupMissingTasks(installedTasks, steps, friendlyName, skipOK) {
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
        common.result(`  ${tryGetTaskName(installedTasks, stepTask.id)} ${stepTask.versionSpec} ${step.displayName}`);
    }
    if (shownName === false && skipOK === false) {
        common.result(`${Colors.green("OK")} Task Group: ${friendlyName}`);
    }
}
function dumpReleaseMissingTasks(installedTasks, releaseDefinition, skipOK) {
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
                common.result(`  ${tryGetTaskName(installedTasks, step.taskId)} ${step.version} ${step.name} [${environment.name}] ->[${phase.name}]`);
            }
        }
    }
    if (shownName === false && skipOK === false) {
        common.result(`${Colors.green("OK")} Release: ${releaseDefinition.name}`);
    }
}
function run(organizationUrl, projectName, skipOK) {
    return __awaiter(this, void 0, void 0, function* () {
        const webApi = yield common.getWebApi(organizationUrl);
        const coreApiObject = yield webApi.getCoreApi();
        const taskAgentApi = yield webApi.getTaskAgentApi();
        const releaseApi = yield webApi.getReleaseApi();
        const buildApi = yield webApi.getBuildApi();
        if (skipOK) {
            console.log(Colors.yellow("Will skip ok results"));
        }
        common.heading("Getting tasks");
        const installedTasks = yield taskAgentApi.getTaskDefinitions();
        common.result(`Found ${installedTasks.length} tasks`);
        common.heading("Getting projects");
        const projects = yield coreApiObject.getProjects();
        for (var projectReference in projects) {
            const project = projects[projectReference];
            if (projectName && project.name !== projectName) {
                continue;
            }
            common.heading(`Project: ${project.name}`);
            const pipelines = yield buildApi.getDefinitions(project.id);
            for (var pipelineName in pipelines) {
                const pipeline = pipelines[pipelineName];
                if (pipeline.type === BuildInterfaces_1.DefinitionType.Build) {
                    const definition = yield buildApi.getDefinition(project.id, pipeline.id);
                    dumpPipelineMissingTasks(installedTasks, definition, skipOK);
                }
                else {
                    common.result(`skipping YAML ${pipeline.name}`);
                }
            }
            const taskGroups = yield taskAgentApi.getTaskGroups(project.id);
            for (var taskGroupKey in taskGroups) {
                const taskGroup = taskGroups[taskGroupKey];
                dumpTaskGroupMissingTasks(installedTasks, taskGroup.tasks, taskGroup.friendlyName, skipOK);
            }
            var releaseDefinitions = yield releaseApi.getReleaseDefinitions(project.id);
            for (var releaseDefinitionName in releaseDefinitions) {
                const releaseDefinition = yield releaseApi.getReleaseDefinition(project.id, releaseDefinitions[releaseDefinitionName].id);
                dumpReleaseMissingTasks(installedTasks, releaseDefinition, skipOK);
            }
        }
    });
}
exports.run = run;
///////////////////////////////////////////////////// main
if (process.env["API_TOKEN"] === null) {
    console.error("You need to define an environment variable called API_TOKEN with your Personal access token (PAT)");
    process.exit(-3);
}
const yargs = require('yargs');
const argv = require('yargs')
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
run(argv.org, argv.project, argv.skipOK);
