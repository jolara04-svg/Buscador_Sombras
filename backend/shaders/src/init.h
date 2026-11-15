#ifndef $INIT_H
#define $INIT_H
#ifdef __cplusplus
extern "C"{
#endif
typedef enum initializePython_ExitCode{
    initializePython_ExitCode_0,
    initializePython_ExitCode_PATH,
    initializePython_ExitCode_MODULE,
    initializePython_ExitCode_LOCAL_MODULE
}initializePython_ExitCode;
initializePython_ExitCode initializePython();
int isPythonInitialized();
#ifdef __cplusplus
}
#endif
#endif