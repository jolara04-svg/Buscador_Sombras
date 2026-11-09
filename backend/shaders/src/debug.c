#include "debug.h"
PyObject* module=NULL;

void dbg_setup(PyObject* pythonModule){
    if(module!=NULL)
        Py_DECREF(module);
    module=pythonModule;
}

int dbg_renderCube(){
    PyObject* res=PyObject_CallMethod(module, "debug_renderCube", NULL);
    if(res==NULL){
        PyErr_Print();
        PyErr_Clear();
        return -1;
    }
    else{
        Py_DECREF(res);
        return 0;
    }
}