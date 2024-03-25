pub(crate) fn normalize(path: &str) -> String {
    let mut slices = vec![];
    for slice in path.split('/') {
        match slice {
            "." => {}
            ".." => {
                slices.pop();
            }
            _ => {
                slices.push(slice);
            }
        }
    }
    slices.join("/")
}

pub(crate) fn resolve(base: &str, rel: &str) -> String {
    let mut slices = vec![];
    let main = if rel.starts_with('/') {
        &rel[1..]
    } else {
        for slice in base.split('/') {
            match slice {
                "." => {}
                ".." => {
                    slices.pop();
                }
                _ => {
                    slices.push(slice);
                }
            }
        }
        rel
    };
    slices.pop();
    for slice in main.split('/') {
        match slice {
            "." => {}
            ".." => {
                slices.pop();
            }
            _ => {
                slices.push(slice);
            }
        }
    }
    slices.join("/")
}
