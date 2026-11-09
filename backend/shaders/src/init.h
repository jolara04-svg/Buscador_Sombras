#ifdef __cplusplus
extern "C"{
#endif
typedef enum{
    initializePython_ExitCode_0,
    initializePython_ExitCode_PATH,
    initializePython_ExitCode_MODULE,
    initializePython_ExitCode_LOCAL_MODULE
}initializePython_ExitCode;
initializePython_ExitCode initializePython(void);
#ifdef __cplusplus
}
#endif