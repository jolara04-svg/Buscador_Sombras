#include "shadow.h"

#define PI 3.141592653589793

PyObject* module=NULL;

typedef struct{
    double x1;
    double y1;
    double x2;
    double y2;
    double elev;
    double azim;
    PyObject* matrix;
    size_t samples;
}Task;

Task task={
    .matrix=NULL
};

double _result;
ushort _chunk_x;
ushort _chunk_y;
int done=0;
int needChunk=0;
size_t progress;
double numerator;

static const Model EMPTY={(size_t)LLONG_MIN, 0, 0, NULL, NULL};

typedef struct{
    PyObject* surface;
    ushort x;
    ushort y;
    double elev;
    double azim;
}CachedTexture;

#define TEXTURE_CACHE_SIZE 16

CachedTexture textureCache[TEXTURE_CACHE_SIZE];
int textureCache_start;
int textureCache_end;

typedef struct{
    Model* model;
    ushort x;
    ushort y;
}CachedChunk;

#define MODEL_CACHE_SIZE 16

CachedChunk modelCache[MODEL_CACHE_SIZE];
int modelCache_start;
int modelCache_end;


void incref(Model* model){
    if(model->refc & (size_t)LLONG_MIN)
        return;
    model->refc++;
}

void decref(Model* model){
    if(model->refc & (size_t)LLONG_MIN)
        return;
    model->refc--;
    if(model->refc==0)
        free(model);
}

void setModule(PyObject* _module){
    if(module!=NULL)
        Py_DECREF(module);
    module=_module;
    Py_INCREF(module);
}

void latLonToTile(double lon, double lat, double* x, double* y){
    *x=(lon+180)/360*65536;
    lat*=PI/180;
    *y=((1-log(tan(lat)+1/cos(lat))/PI)/2)*65536;
}

void setTask(double lon1, double lat1, double lon2, double lat2, double elev, double azim, size_t samples){
    static const npy_intp SIXTEEN=16;
    float* ptr;
    double cotgelev;
    latLonToTile(lon1, lat1, &task.x1, &task.y1);
    latLonToTile(lon2, lat2, &task.x2, &task.y2);
    task.elev=elev;
    task.azim=azim;
    task.samples=samples;
    elev*=PI/180;
    azim*=PI/180;
    cotgelev=cos(elev)/sin(elev);
    if(task.matrix==NULL){
        task.matrix=PyArray_SimpleNew(1, &SIXTEEN, NPY_FLOAT32);
    }
    ptr=PyArray_GetPtr(task.matrix, 0);
    for(size_t i=0;i<16;i++){
        ptr[i]=0.0;
    }
    ptr[ 0]=1.0;
    ptr[ 5]=1.0;
    ptr[15]=1.0;
    ptr[ 2]=-cos(azim)*cotgelev;
    ptr[ 6]=-sin(azim)*cotgelev;
}

int getResult(double* result){
    *result=_result;
    return done;
}

int getChunk(ushort* x, ushort* y){
    *x=_chunk_x;
    *y=_chunk_y;
    return needChunk;
}

void chacheChunk(Model* model){
    modelCache_end++;
    if(modelCache_end>=MODEL_CACHE_SIZE)
        modelCache_end=0;
    if(modelCache_end==modelCache_start){
        decref(modelCache[modelCache_end].model);
        modelCache_start++; 
    }
    modelCache[modelCache_end].model=model;
    modelCache[modelCache_end].x=_chunk_x;
    modelCache[modelCache_end].y=_chunk_y;
    needChunk=0;
}

int matches_texture(CachedTexture* texture, ushort x, ushort y, double elev, double azim){
    return texture->x==x && texture->y==y && texture->elev==elev && texture->azim==azim;
}

PyObject* getTexture(ushort x, ushort y, double elev, double azim){
    if(textureCache_start<textureCache_end){
        for(int i=textureCache_end; i>=textureCache_start;i--){
            if(matches_texture(&textureCache[i], x, y, elev, azim))
                return textureCache[i].surface;
        }
    }
    else{
        for(int i=textureCache_end-1;i>=0;i--){
            if(matches_texture(&textureCache[i], x, y, elev, azim))
                return textureCache[i].surface;
        }  
          for(int i=TEXTURE_CACHE_SIZE-1;i>=textureCache_start;i--){
            if(matches_texture(&textureCache[i], x, y, elev, azim))
                return textureCache[i].surface;
        }  
    }
    return NULL;
}

int matches_model(CachedChunk* model, ushort x, ushort y){
    return model->x==x && model->y==y;
}

Model* getModel(ushort x, ushort y){
    if(modelCache_start<modelCache_end){
        for(int i=modelCache_start; i<modelCache_end;i++){
            if(matches_model(&modelCache[i], x, y))
                return modelCache[i].model;
        }
    }
    else{
        for(int i=0;i<modelCache_end;i++){
            if(matches_model(&modelCache[i], x, y))
                return modelCache[i].model;
        }  
          for(int i=modelCache_start;i<TEXTURE_CACHE_SIZE;i++){
            if(matches_model(&modelCache[i], x, y))
                return modelCache[i].model;
        }  
    }
    return NULL;
}

void cacheTexture(PyObject* surface, ushort x, ushort y, double elev, double azim){
    textureCache_end++;
    if(textureCache_end>=TEXTURE_CACHE_SIZE)
        textureCache_end=0;
    if(textureCache_end==textureCache_start){
        Py_DECREF(textureCache[textureCache_end].surface);
        textureCache_start++; 
    }
    textureCache[textureCache_end].surface=surface;
    textureCache[textureCache_end].x=x;
    textureCache[textureCache_end].y=y;
    textureCache[textureCache_end].elev=elev;
    textureCache[textureCache_end].azim=azim;
}

typedef Vertex _Triangle[3];

#define CHUNK_SIZE_MADRID 465.5605621047439;

int executeTask(void){
    Model* model;
    PyObject* surface;
    PyObject* vertices;
    PyObject* res;
    ushort x_u;
    ushort y_u;
    double x_f;
    double y_f;
    int t_x;
    int t_y;
    npy_intp dim;
    _Triangle* ptr;
    while(progress<=task.samples){
        x_f=(progress*task.x1+(task.samples-progress)*task.x2)/task.samples;
        y_f=(progress*task.y1+(task.samples-progress)*task.y2)/task.samples;
        x_u=(ushort)x_f;
        y_u=(ushort)y_f;
        surface=getTexture(x_u, y_u, task.elev, task.azim);
        if(surface==NULL){
            model=getChunk(x_u, y_u);
            if(model==NULL){
                _chunk_x=x_u;
                _chunk_y=y_u;
                needChunk=1;
                return 0;
            }
            dim=model->triangle_count*3;
            vertices=PyArray_SimpleNew(1, &dim, NPY_FLOAT32);
            if(vertices==NULL){
                PyErr_Print();
                PyErr_Clear();
                return -1;
            }
            ptr=PyArray_GetPointer(vertices, 0);
            for(uint32_t i=0;i<model->triangle_count;i++)
                for(char j=0;j<3;j++)
                    for(char k=0;k<3;k++)
                        ptr[i][j][k]=model->vertices[model->triangles[i][j]][k];
            surface=PyObject_CallMethod(module, "castShadows", "OO", vertices, task.matrix);
            Py_DECREF(vertices);
            if(surface==NULL){
                PyErr_Print();
                PyErr_Clear();
                return -1;
            }
            cacheTexture(surface, x_u, y_u, task.elev, task.azim);  
        }
        t_x=(int)(x_f-(double)x_u)*256;
        t_y=(int)(y_f-(double)y_u)*256;
        res=PyObject_CallMethod(module, "getShadedAt", "Oll", surface, t_x, t_y);
        if(res==NULL){
            PyErr_Print();
            PyErr_Clear();
            return -1;
        }
        if(Py_IsTrue(res)){
            numerator++;
        }
    }
    _result=numerator/task.samples;
    done=1;
    return 0;
}