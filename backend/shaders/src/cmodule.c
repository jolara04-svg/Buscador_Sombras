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

static PyObject* getModel(PyObject* self, PyObject* args){
    int x, y;
    if(!PyArg_ParseTuple(args, "ll"), &x, &y)
        return NULL;
    return Py_None;
}

static struct PyMethodDef methods[]={
    {"getFilePath", getFilePath, METH_NOARGS, "Returns the working path, NOT ending in '/'"},
    {"getModel", getModel, METH_VARARGS, ""},
    {NULL, NULL, 0, NULL}
};

static struct PyModuleDef module={
    .m_methods=methods
};

PyObject* cmodule_init(void){
    return PyModuleDef_Init(&module);
}