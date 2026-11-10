#include "includes.h"
#include "init.h"
#include "cmodule.h"
#include "debug.h"

PyObject* shaderModule=NULL;
PyObject* importPath=NULL;
int _initialized=0;

initializePython_ExitCode initializePython(void){
    char filePath[sizeof(__FILE__)];
    PyObject* sys_path;
    size_t j;
    if(!Py_IsInitialized()){
        PyImport_AppendInittab("cmodule", cmodule_init);
        Py_Initialize();
    }
    if(importPath==NULL){
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
            PyErr_Clear();  
            return initializePython_ExitCode_PATH;
        }
        if(PyList_Append(sys_path, importPath)){
            PyErr_Print();
            PyErr_Clear();
            Py_DECREF(importPath);
            return initializePython_ExitCode_PATH;
        }
        Py_INCREF(importPath);
        setFilePath(importPath);
    }
    if(shaderModule==NULL){
        shaderModule=PyImport_ImportModule("shader");
        if(shaderModule==NULL){
            PyErr_Print();
            PyErr_Clear();
            return initializePython_ExitCode_LOCAL_MODULE;
        }
    }
    Py_INCREF(shaderModule);
    dbg_setup(shaderModule);
    _initialized=1;
    return initializePython_ExitCode_0;
}

int isPythonInitialized(void){
    return _initialized;
}