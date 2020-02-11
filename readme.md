# Report Missing Tasks

Basic script that scans pipelines (except YAML), release management and task groups for tasks that are not installed.

## Pre requirements

node
run npm install on the main folder go install dependencies by issuing the command

> npm install --only=prod

A PAT token with the following scopes

* Agent Pools - Read
* Build - Read
* Release - Read
* Task Group - Read

Set an environment variable called API_TOKEN with the value of the token

In windows use 
> set API_TOKEN=XXXXXX
In Linux use
> export API_TOKEN=XXXXXX

The token is NOT persisted anywhere so you need to set it every time you start a new shell

## Usage

node get-tasks.js --org http://dev.azure.com/REPLACEWITHORGNAME [--project projectName] [--skipOK]
