rmdir /s package
call npm run package:compile
cd package
copy ..\package.json
copy ..\package-lock.json
call npm install --only=prod 
cd ..
