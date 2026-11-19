#include "cmodule.h"

PyObject* filePath;

void setFilePath(PyObject* newFilePath){
    if(filePath!=NULL)
        Py_DECREF(filePath);
    filePath=newFilePath;
}

static PyObject* getFilePath(PyObject* self, PyObject* args){
    if(filePath==NULL){
        PyErr_SetString(PyExc_RuntimeError, "filePath has not been set");
        return NULL;
    }
    Py_INCREF(filePath);
    return filePath;
}

int _firstPass=1;
static PyObject* firstPass(PyObject* self, PyObject* args){
    if(_firstPass){
        _firstPass=0;
        Py_RETURN_TRUE;
    }
    else
        Py_RETURN_FALSE;
}

static struct PyMethodDef methods[]={
    {"getFilePath", getFilePath, METH_NOARGS, "Returns the working path, NOT ending in '/'"},
    {"firstPass", firstPass, METH_NOARGS, "Returns True on the first call. Returns False on subsequent calls."},
    {NULL, NULL, 0, NULL}
};

static struct PyModuleDef module={
    .m_methods=methods
};

PyObject* cmodule_init(void){
    return PyModuleDef_Init(&module);
}