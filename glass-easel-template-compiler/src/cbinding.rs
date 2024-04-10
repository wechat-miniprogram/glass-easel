use std::slice;

use crate::{group, parse::ParseError};

#[repr(C)]
struct StrRef {
    buf: *mut u8,
    len: usize,
}

impl StrRef {
    #[no_mangle]
    pub extern "C" fn str_ref_free(self) {
        // empty
    }
}

impl Drop for StrRef {
    fn drop(&mut self) {
        unsafe {
            let _ = Box::from_raw(slice::from_raw_parts_mut(self.buf, self.len));
        }
    }
}

impl<T: ToString> From<T> for StrRef {
    fn from(s: T) -> Self {
        let s = s.to_string().into_boxed_str().into_boxed_bytes();
        let len = s.len();
        Self {
            buf: Box::into_raw(s) as *mut u8,
            len,
        }
    }
}

#[repr(C)]
struct StrRefArray {
    buf: *mut StrRef,
    len: usize,
}

impl StrRefArray {
    #[no_mangle]
    pub extern "C" fn str_ref_array_free(self) {
        // empty
    }
}

impl From<Box<[StrRef]>> for StrRefArray {
    fn from(v: Box<[StrRef]>) -> Self {
        let len = v.len();
        let buf = Box::into_raw(v) as *mut StrRef;
        Self { buf, len }
    }
}

impl Drop for StrRefArray {
    fn drop(&mut self) {
        let _: Box<[StrRef]> = unsafe {
            Box::from_raw(slice::from_raw_parts_mut(self.buf, self.len) as *mut [StrRef])
        };
    }
}

#[repr(C)]
struct TmplParseWarning {
    message: StrRef,
    start_line: u32,
    start_col: u32,
    end_line: u32,
    end_col: u32,
}

impl TmplParseWarning {
    #[no_mangle]
    pub extern "C" fn tmpl_parse_warning_free(self) {
        // empty
    }
}

impl From<ParseError> for TmplParseWarning {
    fn from(e: ParseError) -> Self {
        Self {
            message: e.kind.to_string().into(),
            start_line: e.location.start.line,
            start_col: e.location.start.utf16_col,
            end_line: e.location.end.line,
            end_col: e.location.end.utf16_col,
        }
    }
}

#[repr(C)]
struct TmplParseWarningArray {
    buf: *mut TmplParseWarning,
    len: usize,
}

impl TmplParseWarningArray {
    fn new(arr: impl Iterator<Item = TmplParseWarning>) -> Self {
        let v: Box<_> = arr.collect();
        let len = v.len();
        let buf = Box::into_raw(v) as *mut _;
        Self { buf, len }
    }

    #[no_mangle]
    pub extern "C" fn tmpl_parse_warning_array_free(self) {
        // empty
    }
}

impl Drop for TmplParseWarningArray {
    fn drop(&mut self) {
        let _: Box<[TmplParseWarning]> = unsafe {
            Box::from_raw(slice::from_raw_parts_mut(self.buf, self.len) as *mut [TmplParseWarning])
        };
    }
}

#[repr(C)]
struct TmplGroup {
    inner: *mut (),
}

impl TmplGroup {
    #[no_mangle]
    pub unsafe extern "C" fn tmpl_group_new() -> Self {
        Self {
            inner: Box::into_raw(Box::new(group::TmplGroup::new())) as *mut (),
        }
    }

    #[no_mangle]
    pub unsafe extern "C" fn tmpl_group_free(self) {
        // empty
    }

    unsafe fn inner(&self) -> &group::TmplGroup {
        &*(self.inner as *const group::TmplGroup)
    }

    unsafe fn inner_mut(&mut self) -> &mut group::TmplGroup {
        &mut *(self.inner as *mut group::TmplGroup)
    }

    #[no_mangle]
    pub unsafe extern "C" fn tmpl_group_add_tmpl(
        &mut self,
        path_buf: &u8,
        path_len: usize,
        content_buf: &u8,
        content_len: usize,
    ) -> TmplParseWarningArray {
        let path = String::from_utf8_lossy(slice::from_raw_parts(path_buf, path_len));
        let content = String::from_utf8_lossy(slice::from_raw_parts(content_buf, content_len));
        TmplParseWarningArray::new(
            self.inner_mut()
                .add_tmpl(&path, &content)
                .into_iter()
                .map(|x| x.into()),
        )
    }

    #[no_mangle]
    pub unsafe extern "C" fn tmpl_group_add_script(
        &mut self,
        path_buf: &u8,
        path_len: usize,
        content_buf: &u8,
        content_len: usize,
    ) {
        let path = String::from_utf8_lossy(slice::from_raw_parts(path_buf, path_len));
        let content = String::from_utf8_lossy(slice::from_raw_parts(content_buf, content_len));
        self.inner_mut().add_script(&path, &content);
    }

    #[no_mangle]
    pub unsafe extern "C" fn tmpl_group_get_direct_dependencies(
        &self,
        path_buf: &u8,
        path_len: usize,
    ) -> StrRefArray {
        let path = String::from_utf8_lossy(slice::from_raw_parts(path_buf, path_len)).to_string();
        self.inner()
            .direct_dependencies(&path)
            .map(|x| x.map(|x| x.into()).collect::<Box<_>>())
            .unwrap_or_default()
            .into()
    }

    #[no_mangle]
    pub unsafe extern "C" fn tmpl_group_get_script_dependencies(
        &self,
        path_buf: &u8,
        path_len: usize,
    ) -> StrRefArray {
        let path = String::from_utf8_lossy(slice::from_raw_parts(path_buf, path_len)).to_string();
        self.inner()
            .script_dependencies(&path)
            .map(|x| x.map(|x| x.into()).collect::<Box<_>>())
            .unwrap_or_default()
            .into()
    }

    #[no_mangle]
    pub unsafe extern "C" fn tmpl_group_get_inline_script_module_names(
        &self,
        path_buf: &u8,
        path_len: usize,
    ) -> StrRefArray {
        let path = String::from_utf8_lossy(slice::from_raw_parts(path_buf, path_len)).to_string();
        self.inner()
            .inline_script_module_names(&path)
            .map(|x| x.map(|x| x.into()).collect::<Box<_>>())
            .unwrap_or_default()
            .into()
    }

    #[no_mangle]
    pub unsafe extern "C" fn tmpl_group_get_inline_script(
        &self,
        path_buf: &u8,
        path_len: usize,
        module_name_buf: &u8,
        module_name_len: usize,
    ) -> StrRef {
        let path = String::from_utf8_lossy(slice::from_raw_parts(path_buf, path_len)).to_string();
        let module_name =
            String::from_utf8_lossy(slice::from_raw_parts(module_name_buf, module_name_len))
                .to_string();
        self.inner()
            .inline_script_content(&path, &module_name)
            .unwrap_or_default()
            .into()
    }

    #[no_mangle]
    pub unsafe extern "C" fn tmpl_group_get_inline_script_start_line(
        &self,
        path_buf: &u8,
        path_len: usize,
        module_name_buf: &u8,
        module_name_len: usize,
    ) -> u32 {
        let path = String::from_utf8_lossy(slice::from_raw_parts(path_buf, path_len)).to_string();
        let module_name =
            String::from_utf8_lossy(slice::from_raw_parts(module_name_buf, module_name_len))
                .to_string();
        self.inner()
            .inline_script_start_line(&path, &module_name)
            .unwrap_or_default()
            .into()
    }

    #[no_mangle]
    pub unsafe extern "C" fn tmpl_group_set_inline_script(
        &mut self,
        path_buf: &u8,
        path_len: usize,
        module_name_buf: &u8,
        module_name_len: usize,
        content_buf: &u8,
        content_len: usize,
    ) -> i32 {
        let path = String::from_utf8_lossy(slice::from_raw_parts(path_buf, path_len));
        let module_name =
            String::from_utf8_lossy(slice::from_raw_parts(module_name_buf, module_name_len))
                .to_string();
        let content = String::from_utf8_lossy(slice::from_raw_parts(content_buf, content_len));
        let ret = self
            .inner_mut()
            .set_inline_script_content(&path, &module_name, &content);
        if ret.is_err() {
            return -1;
        }
        0
    }

    #[no_mangle]
    pub unsafe extern "C" fn tmpl_group_get_runtime_string(&self) -> StrRef {
        self.inner().get_runtime_string().into()
    }

    #[no_mangle]
    pub unsafe extern "C" fn tmpl_group_set_extra_runtime_script(
        &mut self,
        content_buf: &u8,
        content_len: usize,
    ) {
        let content = String::from_utf8_lossy(slice::from_raw_parts(content_buf, content_len));
        self.inner_mut().set_extra_runtime_script(&content);
    }

    #[no_mangle]
    pub unsafe extern "C" fn tmpl_group_get_runtime_var_list() -> StrRef {
        crate::TmplGroup::get_runtime_var_list().join(",").into()
    }

    #[no_mangle]
    pub unsafe extern "C" fn tmpl_group_get_tmpl_gen_object(
        &self,
        path_buf: &u8,
        path_len: usize,
    ) -> StrRef {
        let path = String::from_utf8_lossy(slice::from_raw_parts(path_buf, path_len)).to_string();
        self.inner()
            .get_tmpl_gen_object(&path)
            .unwrap_or_default()
            .into()
    }

    #[no_mangle]
    pub unsafe extern "C" fn tmpl_group_get_tmpl_gen_object_groups(&self) -> StrRef {
        self.inner()
            .get_tmpl_gen_object_groups()
            .unwrap_or_default()
            .into()
    }

    #[no_mangle]
    pub unsafe extern "C" fn tmpl_group_get_wx_gen_object_groups(&self) -> StrRef {
        self.inner()
            .get_wx_gen_object_groups()
            .unwrap_or_default()
            .into()
    }

    #[no_mangle]
    pub unsafe extern "C" fn tmpl_group_export_globals(&self) -> StrRef {
        self.inner().export_globals().unwrap_or_default().into()
    }

    #[no_mangle]
    pub unsafe extern "C" fn tmpl_group_export_all_scripts(&self) -> StrRef {
        self.inner().export_all_scripts().unwrap_or_default().into()
    }
}

impl Drop for TmplGroup {
    fn drop(&mut self) {
        unsafe {
            let _ = Box::from_raw(&mut *(self.inner as *mut group::TmplGroup));
        }
    }
}
