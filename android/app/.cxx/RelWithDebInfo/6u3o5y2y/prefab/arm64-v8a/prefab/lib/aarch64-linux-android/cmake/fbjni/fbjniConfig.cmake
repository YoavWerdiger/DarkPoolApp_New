if(NOT TARGET fbjni::fbjni)
add_library(fbjni::fbjni SHARED IMPORTED)
set_target_properties(fbjni::fbjni PROPERTIES
    IMPORTED_LOCATION "/Users/yoavwerdiger/.gradle/caches/8.14.3/transforms/b7e0eb2bd95e864fda3d2e201827629b/transformed/fbjni-0.7.0/prefab/modules/fbjni/libs/android.arm64-v8a/libfbjni.so"
    INTERFACE_INCLUDE_DIRECTORIES "/Users/yoavwerdiger/.gradle/caches/8.14.3/transforms/b7e0eb2bd95e864fda3d2e201827629b/transformed/fbjni-0.7.0/prefab/modules/fbjni/include"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

