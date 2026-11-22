#include "includes.h"
#include "shadowCalc.h"
#define PI 3.141592653589793
#define SCALE 0.004295896523017839
#define SIZE 465.56766610355527
#define RADIUS 1
#define DIAMETER (2*RADIUS+1)
#define OFFSET_TILE(z, k) ((z)+(k)-RADIUS)
#define OFFSET_METERS(z) (SIZE*((z)-RADIUS))
#define MODEL_CACHE_SIZE 64
#define TEXTURE_CACHE_SIZE 64
#define PATH_SIZE 1024
#define OFFSET_SIZE 64
#define borrowed
#define stolen
#define USE_BACKSLASH
#define INDEX_TEXTURE(ptr, x, y) (((char*)(ptr))[((x)<<5)+((y)>>3)]&(1<<((y)&7)))

typedef unsigned char uchar;
typedef unsigned short ushort;
typedef unsigned long ulong;
typedef float Vertex[3];
typedef ulong Triangle[3];
typedef struct{
    size_t refc;
    uint32_t vertex_count;
    uint32_t triangle_count;
    Vertex* vertices;
    Triangle* triangles;
}Model;
typedef struct{
    Model* model;
    ushort x;
    ushort y;
}CachedChunk;
typedef struct{
    PyObject* surface;
    ushort x;
    ushort y;
    double elev;
    double azim;
}CachedTexture;
typedef Vertex _Triangle[3];
static const npy_intp SIXTEEN=16;
static const Model EMPTY={(size_t)LLONG_MIN, 0, 0, NULL, NULL};
static PyObject* module=NULL;
static PyObject* trimesh=NULL;
static PyObject* numpy=NULL;
CachedChunk modelCache[MODEL_CACHE_SIZE];
int modelCache_start=0;
int modelCache_end=-1;
CachedTexture textureCache[TEXTURE_CACHE_SIZE];
int textureCache_start=0;
int textureCache_end=-1;
char filePath[PATH_SIZE];
char fileName[PATH_SIZE];

void setModule(PyObject* _module){
    if(module!=NULL)
        Py_DECREF(module);
    module=_module;
    Py_INCREF(module);
}

void setTrimesh(PyObject* _module){
    if(trimesh!=NULL)
        Py_DECREF(trimesh);
    trimesh=_module;
    Py_INCREF(trimesh);
}

void setMadridFilePath(){
    size_t j=strlen(__FILE__);
    size_t c=3;
    strcpy(filePath, __FILE__);
    while(j>0){
        j--;
        if(filePath[j]=='/'||filePath[j]=='\\'){
            c--;
            if(c==0){
                filePath[j]=0;
                break;
            }
        }
    }
    if(j==0)
        Py_UNREACHABLE();
#ifdef USE_BACKSLASH
    strcpy(&filePath[strlen(filePath)],"\\madrid_chunks\\16\\%hu\\%hu.glb");
#else
    strcpy(&filePath[strlen(filePath)],"/madrid_chunks/16/%hu/%hu.glb");
#endif
}

void incref(Model* model){
    if(model->refc & (size_t)LLONG_MIN)
        return;
    model->refc++;
}

void decref(Model* model){
    if(model->refc & (size_t)LLONG_MIN)
        return;
    model->refc--;
    if(model->refc==0){
        free(model->vertices);
        free(model->triangles);
        free(model);
    }
}

int matches_model(CachedChunk* model, ushort x, ushort y){
    return model->x==x && model->y==y;
}

borrowed Model* getCachedChunk(ushort x, ushort y){
    if(modelCache_end<0)
        return NULL;
    if(modelCache_start<modelCache_end){
        for(int i=modelCache_end-1; i>=modelCache_start; i--){
            if(matches_model(&modelCache[i], x, y))
                return modelCache[i].model;
        }
    }
    else{
        for(int i=modelCache_end; i>=0; i--){
            if(matches_model(&modelCache[i], x, y))
                return modelCache[i].model;
        }
        for(int i=MODEL_CACHE_SIZE-1; i>=modelCache_start; i--){
            if(matches_model(&modelCache[i], x, y))
                return modelCache[i].model;
        }
    }
    return NULL;
}

void cacheChunk(stolen Model* model, ushort x, ushort y){
    if(modelCache_end<0){
        modelCache[modelCache_start].model=model;
        modelCache[modelCache_start].x=x;
        modelCache[modelCache_start].y=y;
        modelCache_end=modelCache_start+1;
        if(modelCache_end>=MODEL_CACHE_SIZE)
            modelCache_end=0;
    }
    else{
        if(modelCache_end==modelCache_start){
            decref(modelCache[modelCache_start].model);
            modelCache_start++;
            if(modelCache_start>=MODEL_CACHE_SIZE)
                modelCache_start=0;
        }
        modelCache[modelCache_end].model=model;
        modelCache[modelCache_end].x=x;
        modelCache[modelCache_end].y=y;
        modelCache_end++;
        if(modelCache_end>=MODEL_CACHE_SIZE)
            modelCache_end=0;
    }
}

void modelCache_clear(void){
    if(modelCache_end<0)
        return;
    if(modelCache_start<modelCache_end)
        for(int i=modelCache_end-1; i>=modelCache_start; i--)
            decref(modelCache[i].model);
    else{
        for(int i=modelCache_end; i>=0; i--)
            decref(modelCache[i].model);
        for(int i=MODEL_CACHE_SIZE-1; i>=modelCache_start; i--)
            decref(modelCache[i].model);
    }
    modelCache_end=-1;
}

int matches_texture(CachedTexture* surface, ushort x, ushort y, double elev, double azim){
    return surface->x==x && surface->y==y && surface->elev==elev && surface->azim==azim;
}

borrowed PyObject* getCachedTexture(ushort x, ushort y, double elev, double azim){
    if(textureCache_end<0)
        return NULL;
    if(textureCache_start<textureCache_end){
        for(int i=textureCache_end-1; i>=textureCache_start; i--){
            if(matches_texture(&textureCache[i], x, y, elev, azim))
                return textureCache[i].surface;
        }
    }
    else{
        for(int i=textureCache_end; i>=0; i--){
            if(matches_texture(&textureCache[i], x, y, elev, azim))
                return textureCache[i].surface;
        }
        for(int i=TEXTURE_CACHE_SIZE-1; i>=textureCache_start; i--){
            if(matches_texture(&textureCache[i], x, y, elev, azim))
                return textureCache[i].surface;
        }
    }
    return NULL;
}

void textureCache_clear(void){
    if(textureCache_end<0)
        return;
    if(textureCache_start<textureCache_end)
        for(int i=textureCache_end-1; i>=textureCache_start; i--)
            Py_DECREF(textureCache[i].surface);
    else{
        for(int i=textureCache_end; i>=0; i--)
            Py_DECREF(textureCache[i].surface);
        for(int i=TEXTURE_CACHE_SIZE-1; i>=textureCache_start; i--)
            Py_DECREF(textureCache[i].surface);
    }
    textureCache_end=-1;
}

void cacheTexture(stolen PyObject* surface, ushort x, ushort y, double elev, double azim){
    if(textureCache_end<0){
        textureCache[textureCache_start].surface=surface;
        textureCache[textureCache_start].x=x;
        textureCache[textureCache_start].y=y;
        textureCache[textureCache_start].elev=elev;
        textureCache[textureCache_start].azim=azim;
        textureCache_end=textureCache_start+1;
        if(textureCache_end>=TEXTURE_CACHE_SIZE)
            textureCache_end=0;
    }
    else{
        if(textureCache_end==textureCache_start){
            Py_DECREF(textureCache[textureCache_start].surface);
            textureCache_start++;
            if(textureCache_start>=TEXTURE_CACHE_SIZE)
                textureCache_start=0;
        }
        textureCache[textureCache_end].surface=surface;
        textureCache[textureCache_end].x=x;
        textureCache[textureCache_end].y=y;
        textureCache[textureCache_end].elev=elev;
        textureCache[textureCache_end].azim=azim;
        textureCache_end++;
        if(textureCache_end>=TEXTURE_CACHE_SIZE)
            textureCache_end=0;
    }
}

void latLonToTile(double lon, double lat, double* x, double* y){
    *x=(lon+180)/360*65536;
    lat*=PI/180;
    *y=((1 - log(tan(lat) + 1 / cos(lat)) / PI) / 2) * 65536;
}

PyObject* getMatrix(double elev, double azim){
    if(sin(elev)==0.0){
        PyErr_SetString(PyExc_ZeroDivisionError, "sin(elev) was zero");
        return NULL;
    }
    float* ptr;  
    const double cotg=cos(elev)/sin(elev);
    //PyArrayObject* res=PyArray_SimpleNew(1, &SIXTEEN, NPY_FLOAT32);
    PyObject* float32=PyObject_GetAttrString(numpy, "float32");
    PyObject* res=PyObject_CallMethod(numpy, "empty", "(ll)O", 4, 4, float32);
    Py_DECREF(float32);
    if(res==NULL)
        return NULL;
    ptr=PyArray_GETPTR1(res, 0);
    for(int i=0; i<16; i++){
        ptr[i]=0.0f;
    }
    ptr[ 0]=(float)SCALE;
    ptr[ 5]=(float)SCALE;
    ptr[15]=1.0f;
    ptr[ 2]=(float)-cotg*cos(azim)*SCALE;
    ptr[ 6]=(float)-cotg*sin(azim)*SCALE;
    return res;
}

size_t getLength(PyObject* array){
    PyObject* shape;
    PyObject* number;
    shape=PyObject_GetAttrString(array, "shape");
    if(shape==NULL)
        return -1;
    if(!PyTuple_CheckExact(shape)){
        PyErr_SetString(PyExc_TypeError, "shape was not a tuple");
        return -1;
    }
    number=PyTuple_GetItem(shape, 0);
    Py_DECREF(shape);
    if(number==NULL)
        return -1;
    return PyLong_AsSize_t(number);
}



int reserve(Model* model, PyObject* list){
    PyObject* iter;
    PyObject* item;
    PyObject* vertices;
    PyObject* triangles;
    iter=PyObject_GetIter(list);
    if(iter==NULL)
        return -1;
    while(item=PyIter_Next(iter)){
        vertices=PyObject_GetAttrString(item, "vertices");
        if(vertices==NULL){
            Py_DECREF(iter);
            Py_DECREF(item);
            return -1;
        }
        model->vertex_count+=getLength(vertices);
        if(PyErr_Occurred()){
            Py_DECREF(iter);
            Py_DECREF(item);
            return -1;
        }
        Py_DECREF(vertices);

        triangles=PyObject_GetAttrString(item, "faces");
        if(triangles==NULL){
            Py_DECREF(iter);
            Py_DECREF(item);
            return -1;
        }
        model->triangle_count+=getLength(triangles);
        if(PyErr_Occurred()){
            Py_DECREF(iter);
            Py_DECREF(item);
            return -1;
        }
        Py_DECREF(triangles);

        Py_DECREF(item);
    }
    Py_DECREF(iter);
    if(PyErr_Occurred())
        return -1;

    
    model->vertices=malloc(model->vertex_count*sizeof(Vertex));
    if(model->vertices==NULL)
        return -1;

    model->triangles=malloc(model->triangle_count*sizeof(Triangle));
    if(model->triangles==NULL){
        free(model->vertices);
        return -1;
    }
    //printf("vertex_count=%u, triangle_count=%u\n", model->vertex_count, model->triangle_count);
    return 0;
}

size_t copyTriangles(Triangle* dest, PyObject* src, size_t start, size_t offset){
    if(PyErr_Occurred()){
        PyErr_Print();
    }
    PyObject* row;
    PyObject* elem;
    PyObject* index;
    PyObject* number;
    size_t length;
    length=getLength(src);
    if(PyErr_Occurred())
        return -1;
    for(size_t i=0; i<length; i++){
        index=PyLong_FromSize_t(i);
        if(index==NULL)
            return -1;
        row=PyObject_GetItem(src, index);
        Py_DECREF(index);
        if(row==NULL)
            return -1;
        for(size_t j=0; j<3; j++){
            index=PyLong_FromSize_t(j);
            if(index==NULL){
                Py_DECREF(row);
                return -1;
            }
            elem=PyObject_GetItem(row, index);
            Py_DECREF(index);
            if(elem==NULL){
                Py_DECREF(row);
                return -1;
            }
            number=PyNumber_Long(elem);
            Py_DECREF(elem);
            if(number==NULL){
                Py_DECREF(row);
                return -1;
            }
            dest[start][j]=PyLong_AsSize_t(number)+offset;
            Py_DECREF(number);
            if(PyErr_Occurred()){
                Py_DECREF(row);
                return -1;
            }
        }
        Py_DECREF(row);
        start++;
    }
    return start;
}

size_t copyVertices(Vertex* dest, PyObject* src, size_t start){
    PyObject* row;
    PyObject* elem;
    PyObject* index;
    size_t length;
    length=getLength(src);
    if(PyErr_Occurred())
        return -1;
    for(size_t i=0; i<length; i++){
        index=PyLong_FromSize_t(i);
        if(index==NULL)
            return -1;
        row=PyObject_GetItem(src, index);
        Py_DECREF(index);
        if(row==NULL)
            return -1;
        for(size_t j=0; j<3; j++){
            index=PyLong_FromSize_t(j);
            if(index==NULL){
                Py_DECREF(row);
                return -1;
            }
            elem=PyObject_GetItem(row, index);
            Py_DECREF(index);
            if(elem==NULL){
                Py_DECREF(row);
                return -1;
            }
            dest[start][j]=PyFloat_AsDouble(elem);
            Py_DECREF(elem);
            if(PyErr_Occurred()){
                Py_DECREF(row);
                return -1;
            }
        }
        Py_DECREF(row);
        start++;
    }
    return start;
}

int populate(Model* model, PyObject* list){
    PyObject* iter;
    PyObject* item;
    PyObject* vertices;
    PyObject* triangles;
    size_t vertex_index=0;
    size_t triangle_index=0;
    iter=PyObject_GetIter(list);
    if(iter==NULL)
        return -1;
    while(item=PyIter_Next(iter)){
        triangles=PyObject_GetAttrString(item, "faces");
        if(triangles==NULL){
            Py_DECREF(iter);
            Py_DECREF(item);
            return -1;
        }
        triangle_index=copyTriangles(model->triangles, triangles, triangle_index, vertex_index);
        Py_DECREF(triangles);
        if(PyErr_Occurred()){
            Py_DECREF(iter);
            Py_DECREF(item);
            return -1;
        }

        vertices=PyObject_GetAttrString(item, "vertices");
        if(vertices==NULL){
            Py_DECREF(iter);
            Py_DECREF(item);
            return -1;
        }
        vertex_index=copyVertices(model->vertices, vertices, vertex_index);
        Py_DECREF(vertices);
        if(PyErr_Occurred()){
            Py_DECREF(iter);
            Py_DECREF(item);
            return -1;
        }
        Py_DECREF(item);
    }
    Py_DECREF(iter);
    if(PyErr_Occurred())
        return -1;
    model->vertex_count=vertex_index;
    model->triangle_count=triangle_index;
    return 0;
}

Model* newModel(borrowed PyObject* mesh){
    Model* model;
    PyObject* list;
    model=malloc(sizeof(Model));
    if(model==NULL){
        return (Model*)PyErr_NoMemory();
    }
    model->refc=1;
    model->vertex_count=0;
    model->triangle_count=0;
    if(PyObject_HasAttrString(mesh, "dump"))
        list=PyObject_CallMethod(mesh, "dump", NULL);
    else
        list=Py_BuildValue("[O]", mesh);
    if(list==NULL){
        free(model);
        return NULL;
    }
    if(reserve(model, list)){
        Py_DECREF(list);
        free(model);
        return NULL;
    }
    if(populate(model, list)){
        Py_DECREF(list);
        decref(model);
        return NULL;
    };
    Py_DECREF(list);
    return model;
}

const borrowed Model* loadModel(ushort x, ushort y){
    PyObject* file;
    PyObject* mesh;
    Model* model;
    snprintf(fileName, PATH_SIZE, filePath, x, y);
    file=PyUnicode_DecodeFSDefault(fileName);
    if(file==NULL)
        return NULL;
    mesh=PyObject_CallMethod(trimesh, "load", "O", file);
    Py_DECREF(file);
    if(mesh==NULL){
        if(PyErr_ExceptionMatches(PyExc_ValueError)){
            PyErr_Clear();
            return &EMPTY;
        }
        else
            return NULL;
    }
    model=newModel(mesh);
    Py_DECREF(mesh);
    if(model==NULL)
        return NULL;
    cacheChunk(model, x, y);
    return model;
}

const borrowed Model* getModel(ushort x, ushort y){
    Model* model;
    model=getCachedChunk(x, y);
    if(model==NULL){
        model=loadModel(x, y);
        if(model==NULL)
            return NULL;
    }
    return model;
}

PyObject* copyArray(Model* models[DIAMETER][DIAMETER]){
    //puts("copyArray");
    size_t size;
    npy_intp A;
    PyObject* dtype;
    PyObject* array;
    _Triangle* ptr; 
    size=0;
    for(int x=0;x<DIAMETER;x++){
        for(int y=0;y<DIAMETER;y++){
            size+=models[x][y]->triangle_count;
        }
    }
    //puts("sum done!");
    //printf("numpy=%p\n", numpy);
    if(PyErr_Occurred()){
        PyErr_Print();
    }
    dtype=PyObject_GetAttrString(numpy, "float32");
    //puts("got (?) dtype");
    if(dtype==NULL){
        //puts("dtype was NULL");
        return NULL;
    }
    //puts("checked dtype");
    //printf("size=%zu\n", size);
    array=PyObject_CallMethod(numpy, "empty", "(K)O", 9*size, dtype);
    //puts("created the array");
    Py_DECREF(dtype);
    if(array==NULL)
        return NULL;
    ptr=PyArray_GETPTR1(array, 0);
    A=0;
    //puts("entering the loop");
    for(int x=0; x<DIAMETER; x++){
        for(int y=0; y<DIAMETER; y++){
            //printf("x=%d, y=%d, A=%zu\n", x, y, A);
            for(size_t i=0; i<models[x][y]->triangle_count; i++){
                for(char j=0; j<3; j++){
                    ptr[A][j][0]=models[x][y]->vertices[models[x][y]->triangles[i][j]][0]+OFFSET_METERS(x);
                    ptr[A][j][1]=models[x][y]->vertices[models[x][y]->triangles[i][j]][1]+OFFSET_METERS(y);
                    ptr[A][j][2]=models[x][y]->vertices[models[x][y]->triangles[i][j]][2];
                }
                A++;    
            }
        }
    }
    return array;
}

int getModelMatrix(Model* model[DIAMETER][DIAMETER], ushort x, ushort y){
    for(int i=0;i<DIAMETER;i++){
        for(int j=0;j<DIAMETER;j++){
            model[i][j]=getModel(OFFSET_TILE(x, i), OFFSET_TILE(y, j));
            if(model[i][j]==NULL)
                return -1;
        }
    }
    for(int i=0;i<DIAMETER;i++)
        for(int j=0;j<DIAMETER;j++)
            incref(model[i][j]);
    return 0;
}

borrowed PyObject* newTexture(ushort x, ushort y, double elev, double azim, PyObject* matrix){
    Model* model[DIAMETER][DIAMETER];
    PyObject* array;
    PyObject* surface;
    size_t length;
    if(getModelMatrix(model, x, y))
        return NULL;
    array=copyArray(model);
    for(int i=0;i<DIAMETER;i++)
        for(int j=0;j<DIAMETER;j++)
            decref(model[i][j]);
    if(array==NULL)
        return NULL;
    length=PyObject_Length(array);
    if(PyErr_Occurred()){
        Py_DECREF(array);
        return NULL;
    }
    length/=3;
#ifndef $DEBUG
    surface=PyObject_CallMethod(module, "castShadows", "OOK", array, matrix, length);
#else
    surface=PyObject_CallMethod(module, "castShadows", "OOKHH", array, matrix, length, x, y);
#endif
    Py_DECREF(array);
    if(surface==NULL)
        return NULL;
    cacheTexture(surface, x, y, elev, azim);
    return surface;
}

borrowed PyObject* getTexture(ushort x, ushort y, double elev, double azim, PyObject* matrix){
    PyObject* texture;
    Model* model;
    PyObject* array;
    PyObject* dtype;
    npy_intp size;
    _Triangle* ptr;
    texture=getCachedTexture(x, y, elev, azim);
    if(texture==NULL)
        texture=newTexture(x, y, elev, azim, matrix);
    return texture;
}

double getShade(double lon1, double lat1, double lon2, double lat2, double elev, double azim, size_t samples){
    double x1, y1, x2, y2;
    PyObject* matrix;
    PyObject* surface;
    PyObject* result;
    ushort xu, yu;
    double xf, yf;
    uchar xt, yt;
    size_t num=0;
    latLonToTile(lon1, lat1, &x1, &y1);
    latLonToTile(lon2, lat2, &x2, &y2);
    matrix=getMatrix(elev, azim);
    if(matrix==NULL){
        PyErr_Print();
        PyErr_Clear();
        return -1.0;
    }
    for(size_t i=0; i<=samples; i++){
        xf=(i*x1+(samples-i)*x2)/samples;
        yf=(i*y1+(samples-i)*y2)/samples;
        xu=(ushort)floor(xf);
        yu=(ushort)floor(yf);
        surface=getTexture(xu, yu, elev, azim, matrix);
        if(surface==NULL){
            PyErr_Print();
            PyErr_Clear();
            Py_DECREF(matrix);
            return -1.0;
        }
        xt=(uchar)(256*(xf-(double)xu));
        yt=(uchar)(256*(yf-(double)yu));
        result=PyObject_CallMethod(module, "getShadeAt", "Oll", surface, (long)xt, (long)yt);
        if(result==NULL){
            PyErr_Print();
            PyErr_Clear();
            Py_DECREF(matrix);
            return -1.0;
        }
        if(Py_IsTrue(result))
            num++;
    }
    Py_DECREF(matrix);
    return num/(samples+1.0);
}

void* initializeNumPy(){
    import_array();
    if(numpy!=NULL)
        Py_DECREF(numpy);
    numpy=PyImport_ImportModule("numpy");
    return numpy;
}