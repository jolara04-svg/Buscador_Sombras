#include "includes.h"
#include "init.h"
#include "cmodule.h"
#include "debug.h"

PyObject* shaderModule=NULL;

initializePython_ExitCode initializePython(void){
    char filePath[sizeof(__FILE__)];
    PyObject* sys_path;
    PyObject* importPath;
    size_t j;
    if(Py_IsInitialized())
        return initializePython_ExitCode_0;
    PyImport_AppendInittab("cmodule", cmodule_init);
    Py_Initialize();
    j=strlen(__FILE__);
    strcpy(filePath, __FILE__);
    while(j>0){
        j--;
        if(filePath[j]=='/'||filePath[j]=='\\'){
            filePath[j]=0;
            break;
        }
    }
    if(j==0)
        Py_UNREACHABLE();
    sys_path=PySys_GetObject("path");
    if(sys_path==NULL)
        Py_UNREACHABLE();
    importPath=PyUnicode_DecodeFSDefault(filePath);
    if(importPath==NULL){
        PyErr_Print();
        Py_Finalize();
        return initializePython_ExitCode_PATH;
    }
    if(PyList_Append(sys_path, importPath)){
        PyErr_Print();
        Py_DECREF(importPath);
        Py_Finalize();
        return initializePython_ExitCode_PATH;
    }
    setFilePath(importPath);
    shaderModule=PyImport_ImportModule("shader");
    if(shaderModule==NULL){
        PyErr_Print();
        Py_Finalize();
        return initializePython_ExitCode_LOCAL_MODULE;
    }
    dbg_setup(shaderModule);
    return initializePython_ExitCode_0;
}