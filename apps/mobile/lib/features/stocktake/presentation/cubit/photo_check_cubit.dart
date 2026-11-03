import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/photo_check.dart';
import '../../domain/photo_quality.dart';
import '../../domain/repositories/photo_tools.dart';
import '../../domain/usecases/stocktake_usecases.dart';

/// The check under a picked photo: the phone's own checks at once, then Muse Spark's verdict (apps/mp's
/// stocktake-flow). Advice only: the scan buttons never wait on it. Per business and photo.
class PhotoCheckCubit extends Cubit<PhotoCheckState> {
  PhotoCheckCubit({required this.businessId, required CheckPhoto checkPhoto, required PhotoTools tools})
    : _checkPhoto = checkPhoto,
      _tools = tools,
      super(const PhotoCheckState());

  final String businessId;
  final CheckPhoto _checkPhoto;
  final PhotoTools _tools;

  /// Bumped per photo: a late answer for an earlier photo is dropped.
  int _gen = 0;

  /// No photo: drop any check in flight.
  void reset() {
    _gen++;
    emit(const PhotoCheckState());
  }

  Future<void> check(ShelfPhoto photo) async {
    final gen = ++_gen;
    bool stale() => isClosed || gen != _gen;
    emit(const PhotoCheckState());
    final local = await _tools.localCheck(photo.bytes);
    if (stale()) return;
    emit(PhotoCheckState(local: local));
    final copy = await _tools.checkCopy(photo);
    if (stale()) return;
    if (copy == null) return emit(PhotoCheckState(local: local, done: true));
    final res = await _checkPhoto(ScanPhotoParams(businessId: businessId, photo: copy));
    if (stale()) return;
    emit(PhotoCheckState(local: local, result: res.fold((_) => null, (r) => r), done: true));
  }
}

class PhotoCheckState extends Equatable {
  const PhotoCheckState({this.local, this.result, this.done = false});

  /// Null until the phone's checks finish, or when the photo couldn't be decoded.
  final LocalPhotoCheck? local;

  /// Null while checking, and when the check failed (busy, offline, too large).
  final PhotoCheck? result;
  final bool done;

  bool get checking => !done;

  @override
  List<Object?> get props => [local, result, done];
}
