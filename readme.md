# Report Missing Tasks

Basic script that scans pipelines (except YAML), release management and task groups for tasks that are not installed.

## Pre requirements

node
run npm install on the main folder go install dependencies by issuing the command

> npm install --only=prod

## Usage

node get-tasks.js --org http://dev.azure.com/REPLACEWITHORGNAME [--project projectName] [--skipOK]
